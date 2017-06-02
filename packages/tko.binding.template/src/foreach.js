
import {
  unwrap, peek
} from 'tko.observable'

import {
    nativeTemplateEngine
} from './nativeTemplateEngine'

import {
  TemplateBindingHandler
} from './templating'

// "foreach: someExpression" is equivalent to "template: { foreach: someExpression }"
// "foreach: { data: someExpression, afterAdd: myfn }" is equivalent to "template: { foreach: someExpression, afterAdd: myfn }"
export class TemplateForEachBindingHandler extends TemplateBindingHandler {
  get value () {
    const modelValue = this.valueAccessor()
    const unwrappedValue = peek(modelValue)    // Unwrap without setting a dependency here

        // If unwrappedValue is the array, pass in the wrapped value on its own
        // The value will be unwrapped and tracked within the template binding
        // (See https://github.com/SteveSanderson/knockout/issues/523)
    if ((!unwrappedValue) || typeof unwrappedValue.length === 'number') {
      return { 'foreach': modelValue, 'templateEngine': nativeTemplateEngine.instance }
    }

        // If unwrappedValue.data is the array, preserve all relevant options and unwrap again value so we get updates
    unwrap(modelValue)
    return {
      foreach: unwrappedValue.data,
      as: unwrappedValue.as,
      includeDestroyed: unwrappedValue.includeDestroyed,
      afterAdd: unwrappedValue.afterAdd,
      beforeRemove: unwrappedValue.beforeRemove,
      afterRender: unwrappedValue.afterRender,
      beforeMove: unwrappedValue.beforeMove,
      afterMove: unwrappedValue.afterMove,
      templateEngine: nativeTemplateEngine.instance
    }
  }
}

// ko.expressionRewriting.bindingRewriteValidators['foreach'] = false; // Can't rewrite control flow bindings
