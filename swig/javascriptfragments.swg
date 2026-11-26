/* -----------------------------------------------------------------------------
 * SWIG reads this file, from the folder given to it with -I, ahead of its own
 * fragments for JavaScript, so a fragment here replaces SWIG 4.5.0's
 * fragment of the same name. Each one converts between types explicitly,
 * and checks the range where a value might not fit, so the generated
 * wrapper builds with no conversion warning. No fragment here asks for
 * another that its code does not call, so a wrapper holds no function it
 * does not use, which is a compiler warning.
 * ----------------------------------------------------------------------------- */

/* An int is read from a JavaScript number that fits in one. */
%fragment(SWIG_AsVal_frag(int),"header") {
SWIGINTERN
int SWIG_AsVal_dec(int)(SWIGV8_VALUE valRef, int* val)
{
  if (!valRef->IsNumber()) {
    return SWIG_TypeError;
  }
  int64_t value = SWIGV8_INTEGER_VALUE(valRef);
  if (value < INT_MIN || value > INT_MAX) {
    return SWIG_OverflowError;
  }
  if (val) *val = static_cast<int>(value);

  return SWIG_OK;
}
}

/* A double is read as it is. Inline, as a wrapper might not use it. */
%fragment(SWIG_AsVal_frag(double),"header") {
SWIGINTERNINLINE
int SWIG_AsVal_dec(double)(SWIGV8_VALUE obj, double *val)
{
  if (!obj->IsNumber()) {
    return SWIG_TypeError;
  }
  if (val) *val = SWIGV8_NUMBER_VALUE(obj);

  return SWIG_OK;
}
}

/* The integer readers below are SWIG 4.5.0's, without the
   SWIG_CanCastAsInteger fragment and the other readers they ask for but do
   not call. */
%fragment(SWIG_AsVal_frag(long),"header") {
SWIGINTERN
int SWIG_AsVal_dec(long)(SWIGV8_VALUE obj, long* val)
{
  if (!obj->IsNumber()) {
    return SWIG_TypeError;
  }
  if(val) *val = (long) SWIGV8_INTEGER_VALUE(obj);

  return SWIG_OK;
}
}

%fragment(SWIG_AsVal_frag(unsigned long),"header") {
SWIGINTERN
int SWIG_AsVal_dec(unsigned long)(SWIGV8_VALUE obj, unsigned long *val)
{
  if(!obj->IsNumber()) {
    return SWIG_TypeError;
  }

  long longVal = (long) SWIGV8_NUMBER_VALUE(obj);

  if(longVal < 0) {
      return SWIG_OverflowError;
  }

  if(val) *val = longVal;

  return SWIG_OK;
}
}

%fragment(SWIG_AsVal_frag(long long),"header",
    fragment="SWIG_LongLongAvailable") {
%#ifdef SWIG_LONG_LONG_AVAILABLE
SWIGINTERN
int SWIG_AsVal_dec(long long)(SWIGV8_VALUE obj, long long* val)
{
  if (!obj->IsNumber()) {
    return SWIG_TypeError;
  }
  if(val) *val = (long long) SWIGV8_INTEGER_VALUE(obj);

  return SWIG_OK;
}
%#endif
}

%fragment(SWIG_AsVal_frag(unsigned long long),"header",
    fragment="SWIG_LongLongAvailable") {
%#ifdef SWIG_LONG_LONG_AVAILABLE
SWIGINTERN
int SWIG_AsVal_dec(unsigned long long)(SWIGV8_VALUE obj, unsigned long long *val)
{
  if(!obj->IsNumber()) {
    return SWIG_TypeError;
  }

  long long longVal = (long long) SWIGV8_NUMBER_VALUE(obj);

  if(longVal < 0) {
      return SWIG_OverflowError;
  }

  if(val) *val = longVal;

  return SWIG_OK;
}
%#endif
}

/* A long becomes a JavaScript number, a double. */
%fragment(SWIG_From_frag(long),"header") {
SWIGINTERNINLINE
SWIGV8_VALUE SWIG_From_dec(long)(long value)
{
  return SWIGV8_NUMBER_NEW(static_cast<double>(value));
}
}

/* An unsigned long becomes a JavaScript integer when it fits in 32 bits,
   and a JavaScript number otherwise. */
%fragment(SWIG_From_frag(unsigned long),"header") {
SWIGINTERNINLINE
SWIGV8_VALUE SWIG_From_dec(unsigned long)(unsigned long value)
{
  return value <= UINT32_MAX
    ? (SWIGV8_VALUE)SWIGV8_INTEGER_NEW_UNS(static_cast<uint32_t>(value))
    : (SWIGV8_VALUE)SWIGV8_NUMBER_NEW(static_cast<double>(value));
}
}

/* A long long becomes a JavaScript number, a double. */
%fragment(SWIG_From_frag(long long),"header",
    fragment="SWIG_LongLongAvailable") {
%#ifdef SWIG_LONG_LONG_AVAILABLE
SWIGINTERNINLINE
SWIGV8_VALUE SWIG_From_dec(long long)(long long value)
{
  return SWIGV8_NUMBER_NEW(static_cast<double>(value));
}
%#endif
}

/* An unsigned long long becomes a JavaScript integer when it fits in 32
   bits, and a JavaScript number otherwise. */
%fragment(SWIG_From_frag(unsigned long long),"header",
    fragment="SWIG_LongLongAvailable") {
%#ifdef SWIG_LONG_LONG_AVAILABLE
SWIGINTERNINLINE
SWIGV8_VALUE SWIG_From_dec(unsigned long long)(unsigned long long value)
{
  return value <= UINT32_MAX
    ? (SWIGV8_VALUE)SWIGV8_INTEGER_NEW_UNS(static_cast<uint32_t>(value))
    : (SWIGV8_VALUE)SWIGV8_NUMBER_NEW(static_cast<double>(value));
}
%#endif
}

/* A string is made from at most INT_MAX bytes, which is what V8 takes. */
%fragment("SWIG_FromCharPtrAndSize","header",fragment="SWIG_pchar_descriptor") {
SWIGINTERNINLINE SWIGV8_VALUE
SWIG_FromCharPtrAndSize(const char* carray, size_t size)
{
  if (carray && size <= INT_MAX) {
    v8::Local<v8::String> js_str =
      SWIGV8_STRING_NEW2(carray, static_cast<int>(size));
    return js_str;
  }
  return SWIGV8_UNDEFINED();
}
}
