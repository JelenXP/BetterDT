// Pořadí metod ve vtable WebView2 rozhraní, spočítané z oficiální hlavičky (C rozhraní),
// aby v hlavním kódu nebyla ručně psaná čísla.
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
