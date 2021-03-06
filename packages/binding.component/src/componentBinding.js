//
// Binding Handler for Components
//

import {
  virtualElements, makeArray, cloneNodes
} from '@tko/utils'

import {
  unwrap, isObservable
} from '@tko/observable'

import {
  DescendantBindingHandler, applyBindingsToDescendants
} from '@tko/bind'

import {
  JsxObserver, maybeJsx
} from '@tko/utils.jsx'

import {
  NativeProvider
} from '@tko/provider.native'

import {LifeCycle} from '@tko/lifecycle'

import registry from '@tko/utils.component'

var componentLoadingOperationUniqueId = 0

export default class ComponentBinding extends DescendantBindingHandler {
  constructor (params) {
    super(params)
    this.originalChildNodes = makeArray(
      virtualElements.childNodes(this.$element)
    )
    this.computed('computeApplyComponent')
  }

  cloneTemplateIntoElement (componentName, template, element) {
    if (!template) {
      throw new Error('Component \'' + componentName + '\' has no template')
    }

    if (maybeJsx(template)) {
      virtualElements.emptyNode(element)
      this.addDisposable(new JsxObserver(template, element))

    } else {
      const clonedNodesArray = cloneNodes(template)
      virtualElements.setDomNodeChildren(element, clonedNodesArray)
    }
  }

  createViewModel (componentDefinition, element, originalChildNodes, componentParams) {
    const componentViewModelFactory = componentDefinition.createViewModel
    return componentViewModelFactory
      ? componentViewModelFactory.call(componentDefinition, componentParams, { element: element, templateNodes: originalChildNodes })
      : componentParams // Template-only component
  }

  /**
   * Return the $componentTemplateSlotNodes for the given template
   * @param {HTMLElement|jsx} template
   */
  makeTemplateSlotNodes (originalChildNodes) {
    return Object.assign({}, ...this.genSlotsByName(originalChildNodes))
  }

  /**
   * Iterate over the templateNodes, yielding each '<element slot=name>'
   * as an object * of {name: element}.
   * @param {HTMLElement} templateNodes
   */
  * genSlotsByName (templateNodes) {
    for (const node of templateNodes) {
      if (node.nodeType !== 1) { continue }
      const slotName = node.getAttribute('slot')
      if (!slotName) { continue }
      yield {[slotName]: node}
    }
  }

  computeApplyComponent () {
    const value = unwrap(this.value)
    let componentName
    let componentParams

    if (typeof value === 'string') {
      componentName = value
    } else {
      componentName = unwrap(value.name)
      componentParams = NativeProvider.getNodeValues(this.$element) ||
        unwrap(value.params)
    }

    this.latestComponentName = componentName

    if (!componentName) {
      throw new Error('No component name specified')
    }

    this.loadingOperationId = this.currentLoadingOperationId = ++componentLoadingOperationUniqueId
    registry.get(componentName, (defn) => this.applyComponentDefinition(componentName, componentParams, defn))
  }

  makeChildBindingContext ($component) {
    const ctxExtender = (ctx) => Object.assign(ctx, {
      $component,
      $componentTemplateNodes: this.originalChildNodes,
      $componentTemplateSlotNodes: this.makeTemplateSlotNodes(
        this.originalChildNodes)
    })

    return this.$context.createChildContext($component, undefined, ctxExtender)
  }

  applyComponentDefinition (componentName, componentParams, componentDefinition) {
    // If this is not the current load operation for this element, ignore it.
    if (this.currentLoadingOperationId !== this.loadingOperationId ||
        this.latestComponentName !== componentName) { return }

    // Clean up previous state
    this.cleanUpState()

    const element = this.$element

    // Instantiate and bind new component. Implicitly this cleans any old DOM nodes.
    if (!componentDefinition) {
      throw new Error('Unknown component \'' + componentName + '\'')
    }

    if (componentDefinition.template) {
      this.cloneTemplateIntoElement(componentName, componentDefinition.template, element)
    }

    const componentViewModel = this.createViewModel(componentDefinition, element, this.originalChildNodes, componentParams)

    const viewTemplate = componentViewModel && componentViewModel.template

    if (!viewTemplate && !componentDefinition.template) {
      throw new Error('Component \'' + componentName + '\' has no template')
    }

    if (!componentDefinition.template) {
      this.cloneTemplateIntoElement(componentName, viewTemplate, element)
    }

    this.childBindingContext = this.makeChildBindingContext(componentViewModel)

    if (componentViewModel instanceof LifeCycle) {
      componentViewModel.anchorTo(this.$element)
    }

    this.currentViewModel = componentViewModel

    const onBinding = this.onBindingComplete.bind(this, componentViewModel)
    this.applyBindingsToDescendants(this.childBindingContext, onBinding)
  }

  onBindingComplete (componentViewModel, bindingResult) {
    if (componentViewModel && componentViewModel.koDescendantsComplete) {
      componentViewModel.koDescendantsComplete(this.$element)
    }
    this.completeBinding(bindingResult)
  }

  cleanUpState () {
    const currentView = this.currentViewModel
    const currentViewDispose = currentView && currentView.dispose
    if (typeof currentViewDispose === 'function') {
      currentViewDispose.call(currentView)
    }
    this.currentViewModel = null
    // Any in-flight loading operation is no longer relevant, so make sure we ignore its completion
    this.currentLoadingOperationId = null
  }

  dispose () {
    this.cleanUpState()
    super.dispose()
  }

  get controlsDescendants () { return true }
  static get allowVirtualElements () { return true }
}
