// Method order in the WebView2 interface vtables, computed from the official header (C interface),
// so the main code has no hand-written numbers.
#define CINTERFACE
#define COBJMACROS
#include <stddef.h>
#include <windows.h>
#include "WebView2.h"

#define IDX(T, m) ((int)(offsetof(T, m) / sizeof(void *)))

const int VT_ENV_CREATE_CONTROLLER = IDX(ICoreWebView2EnvironmentVtbl, CreateCoreWebView2Controller);
const int VT_ENV3_CREATE_COMPOSITION = IDX(ICoreWebView2Environment3Vtbl, CreateCoreWebView2CompositionController);
const int VT_ENV10_CREATE_CONTROLLER_OPT = IDX(ICoreWebView2Environment10Vtbl, CreateCoreWebView2ControllerWithOptions);
const int VT_ENV10_CREATE_COMPOSITION_OPT = IDX(ICoreWebView2Environment10Vtbl, CreateCoreWebView2CompositionControllerWithOptions);
