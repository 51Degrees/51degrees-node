/* The IP type constants are read-only variables, and JS_veto_set_variable
 * refuses a write to one. It is given here rather than in
 * ../../swig/javascripthelpers.swg, as the device detection wrapper has no
 * read-only variable and a function nothing uses is a compiler warning. The
 * parameters it does not read are unnamed. */
%insert(runtime) %{
SWIGRUNTIME void JS_veto_set_variable(v8::Local<v8::Name> property, v8::Local<v8::Value> /* value */, const SwigV8PropertyCallbackInfoVoid& /* info */)
{
    char buffer[256];
    char msg[512];
    int res;

    v8::Local<v8::String> sproperty;
    if (property->ToString(SWIGV8_CURRENT_CONTEXT()).ToLocal(&sproperty)) {
      SWIGV8_WRITE_UTF8(sproperty, buffer, 256);
      res = SWIG_snprintf(msg, sizeof(msg), "Tried to write read-only variable: %s.", buffer);
    }
    else {
      res = -1;
    }

    if(res<0) {
      SWIG_exception(SWIG_ERROR, "Tried to write read-only variable.");
    } else {
      SWIG_exception(SWIG_ERROR, msg);
    }
fail: ;
}
%}

%include "node_before.i"
%include "../../cxx/src/ipi/ipi.i"
%include "node_after.i"
