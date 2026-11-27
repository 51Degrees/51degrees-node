/* -----------------------------------------------------------------------------
 * SWIG 4.5.0's javascripthelpers.swg for V8, changed so the wrappers here
 * build with no compiler warning. SWIGV8_AddMemberVariable is left out, as
 * the wrappers never call it.
 * JS_veto_set_variable is left out too, as only a wrapper with a read-only
 * variable uses it, so that wrapper's interface file gives it.
 * ----------------------------------------------------------------------------- */

%insert(runtime) %{

typedef v8::FunctionCallback            SwigV8FunctionCallback;
typedef v8::AccessorNameGetterCallback  SwigV8AccessorGetterCallback;
typedef v8::AccessorNameSetterCallback  SwigV8AccessorSetterCallback;
typedef v8::PropertyCallbackInfo<void>  SwigV8PropertyCallbackInfoVoid;

/**
 * Creates a class template for a class with specified initialization function.
 */
SWIGRUNTIME SWIGV8_FUNCTION_TEMPLATE SWIGV8_CreateClassTemplate(const char* symbol) {
    SWIGV8_HANDLESCOPE_ESC();
    
    v8::Local<v8::FunctionTemplate> class_templ = SWIGV8_FUNCTEMPLATE_NEW_VOID();
    class_templ->SetClassName(SWIGV8_SYMBOL_NEW(symbol));

    SWIGV8_OBJECT_TEMPLATE inst_templ = class_templ->InstanceTemplate();
    inst_templ->SetInternalFieldCount(1);

    SWIGV8_OBJECT_TEMPLATE equals_templ = class_templ->PrototypeTemplate();
    equals_templ->Set(SWIGV8_SYMBOL_NEW("equals"), SWIGV8_FUNCTEMPLATE_NEW(_SWIGV8_wrap_equals));

    SWIGV8_OBJECT_TEMPLATE cptr_templ = class_templ->PrototypeTemplate();
    cptr_templ->Set(SWIGV8_SYMBOL_NEW("getCPtr"), SWIGV8_FUNCTEMPLATE_NEW(_wrap_getCPtr));

    SWIGV8_ESCAPE(class_templ);
}

/**
 * Registers a class method with given name for a given class template.
 */
SWIGRUNTIME void SWIGV8_AddMemberFunction(SWIGV8_FUNCTION_TEMPLATE class_templ, const char* symbol,
  SwigV8FunctionCallback _func) {
    SWIGV8_OBJECT_TEMPLATE proto_templ = class_templ->PrototypeTemplate();
    proto_templ->Set(SWIGV8_SYMBOL_NEW(symbol), SWIGV8_FUNCTEMPLATE_NEW(_func));
}

/**
 * Registers a class method with given name for a given object.
 */
SWIGRUNTIME void SWIGV8_AddStaticFunction(SWIGV8_OBJECT obj, const char* symbol,
  const SwigV8FunctionCallback& _func, v8::Local<v8::Context> context) {
  SWIGV8_MAYBE_CHECK(obj->Set(context, SWIGV8_SYMBOL_NEW(symbol), SWIGV8_FUNCTEMPLATE_NEW(_func)->GetFunction(context).ToLocalChecked()));
}

/**
 * Registers a class method with given name for a given object.
 */
SWIGRUNTIME void SWIGV8_AddStaticVariable(SWIGV8_OBJECT obj, const char* symbol,
  SwigV8AccessorGetterCallback getter, SwigV8AccessorSetterCallback setter,
  v8::Local<v8::Context> context) {
  SWIGV8_MAYBE_CHECK(obj->SetNativeDataProperty(context, SWIGV8_SYMBOL_NEW(symbol), getter, setter));
}

%} // v8_helper_functions
