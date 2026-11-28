/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2019 51 Degrees Mobile Experts Limited, 5 Charlotte Close,
 * Caversham, Reading, Berkshire, United Kingdom RG4 7BY.
 *
 * This Original Work is licensed under the European Union Public Licence (EUPL) 
 * v.1.2 and is subject to its terms as set out below.
 *
 * If a copy of the EUPL was not distributed with this file, You can obtain
 * one at https://opensource.org/licenses/EUPL-1.2.
 *
 * The 'Compatible Licences' set out in the Appendix to the EUPL (as may be
 * amended by the European Commission) shall be deemed incompatible for
 * the purposes of the Work and the provisions of the compatibility
 * clause in Article 5 of the EUPL shall not apply.
 * 
 * If using the Work as, or as part of, a network application, by 
 * including the attribution notice(s) required under Article 5 of the EUPL
 * in the end user terms of the application under an appropriate heading, 
 * such notice(s) shall fulfill the requirements of that article.
 * ********************************************************************* */

/*
 * This file contains swig instructions to be included before everything else
 */

/*
 * Override the overloaded constructor dispatcher template. This is the
 * SWIG template without the unused "self" local, which compilers report
 * as an unused variable.
 */
%fragment ("js_ctor_dispatcher", "templates")
%{
static SwigV8ReturnValue $jswrapper(const SwigV8Arguments &args) {
  SWIGV8_HANDLESCOPE();

  OverloadErrorHandler errorHandler;

  // switch all cases by means of series of if-returns.
  $jsdispatchcases

  // default:
  SWIG_exception_fail(SWIG_ERROR, "Illegal arguments for construction of $jsmangledname");

fail:
  SWIGV8_RETURN(SWIGV8_UNDEFINED());
}
%}

/*
 * Override the overloaded constructor template to
 * carry through the correct error message. The addition is the
 * "goto fail". The branch for V8 versions before 4 is left out, as no
 * supported Node version uses one.
 */
%fragment ("js_ctor_dispatch_case", "templates")
%{
	if(args.Length() == $jsargcount) {
		errorHandler.err.Clear();
		$jswrapper(args, errorHandler);
		if(errorHandler.err.IsEmpty()) {
			return;
		} else {
			goto fail;
		}
	}
%}

/*
 * Override the overloaded function dispatcher template. This is the SWIG
 * template without the unused "jsresult" local, which compilers report as
 * an unused variable.
 */
%fragment("js_function_dispatcher", "templates")
%{
static SwigV8ReturnValue $jswrapper(const SwigV8Arguments &args) {
  SWIGV8_HANDLESCOPE();

  OverloadErrorHandler errorHandler;
  $jscode

  SWIG_exception_fail(SWIG_ERROR, "Illegal arguments for function $jsname.");

  goto fail;
fail:
  SWIGV8_RETURN(SWIGV8_UNDEFINED());
}
%}

/*
 * Override the overloaded constructor and function templates. SWIG names the
 * error handler parameter the same as its global error handler, so that the
 * error macros in the wrapped code reach the parameter, and compilers report
 * the parameter as hiding the global. Here the parameter has its own name,
 * and the macros reach it through a define that lasts only for the function.
 */
%fragment("js_overloaded_ctor", "templates") %{
static SwigV8ReturnValue $jswrapper(const SwigV8Arguments &args, V8ErrorHandler &overloadErrorHandler) {
#define SWIGV8_ErrorHandler overloadErrorHandler
  SWIGV8_HANDLESCOPE();

  SWIGV8_OBJECT self = SWIGV8_ARGS_THIS(args);
  $jslocals
  if(self->InternalFieldCount() < 1) SWIG_exception_fail(SWIG_ERROR, "Illegal call of constructor $jswrapper.");
  if(args.Length() < $jsargrequired || args.Length() > $jsargcount) SWIG_exception_fail(SWIG_ERROR, "Illegal number of arguments for $jswrapper.");
  $jscode

  SWIGV8_SetPrivateData(self, result, SWIGTYPE_$jsmangledtype, SWIG_POINTER_OWN);
  SWIGV8_RETURN(self);

  goto fail;
fail:
  SWIGV8_RETURN(SWIGV8_UNDEFINED());
#undef SWIGV8_ErrorHandler
}
%}

%fragment ("js_overloaded_function", "templates")
%{
static SwigV8ReturnValue $jswrapper(const SwigV8Arguments &args, V8ErrorHandler &overloadErrorHandler)
{
#define SWIGV8_ErrorHandler overloadErrorHandler
  SWIGV8_HANDLESCOPE();

  SWIGV8_VALUE jsresult;
  $jslocals
  $jscode
  SWIGV8_RETURN(jsresult);

  goto fail;
fail:
  SWIGV8_RETURN(SWIGV8_UNDEFINED());
#undef SWIGV8_ErrorHandler
}
%}

/*
 * Override the getter and setter templates. V8 passes every accessor the
 * property name, the value being set and the callback information, and a
 * wrapper does not always use them, which compilers report as unreferenced
 * parameters. Each is marked as intentionally unused.
 */
%fragment("js_getter", "templates")
%{
static SwigV8ReturnValue $jswrapper(v8::Local<v8::Name> property, const SwigV8PropertyCallbackInfo &info) {
  SWIGV8_HANDLESCOPE();
  (void)property;

  SWIGV8_VALUE jsresult;
  $jslocals
  $jscode
  SWIGV8_RETURN_INFO(jsresult, info);

  goto fail;
fail:
  SWIGV8_RETURN_INFO(SWIGV8_UNDEFINED(), info);
}
%}

%fragment("js_setter", "templates")
%{
static void $jswrapper(v8::Local<v8::Name> property, v8::Local<v8::Value> value, const SwigV8PropertyCallbackInfoVoid &info) {
  SWIGV8_HANDLESCOPE();
  (void)property;
  (void)value;
  (void)info;

  $jslocals
  $jscode
  goto fail;
fail:
  return;
}
%}