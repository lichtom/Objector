/**
 * ObjectScratch APP Runtime - Win32 Native Window Addon
 *
 * Creates real Windows native windows using Win32 API (user32.dll).
 * Each window runs on its own thread with its own message loop.
 * Events are dispatched to Node.js via napi_threadsafe_function.
 *
 * This is the equivalent of Python's Tkinter - using OS-native controls.
 */

#include <napi.h>
#include <windows.h>
#include <commctrl.h>
#include <string>
#include <map>
#include <vector>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <functional>
#include <memory>

#pragma comment(lib, "user32.lib")
#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "gdi32.lib")

// ==================== Custom Messages ====================
#define WM_NATIVE_EVENT    (WM_USER + 100)
#define WM_CREATE_CONTROL  (WM_USER + 101)
#define WM_SET_PROPERTY    (WM_USER + 102)
#define WM_GET_PROPERTY    (WM_USER + 103)
#define WM_DESTROY_NATIVE  (WM_USER + 104)

// ==================== Control Types ====================
static const wchar_t* CT_BUTTON  = L"BUTTON";
static const wchar_t* CT_EDIT    = L"EDIT";
static const wchar_t* CT_STATIC  = L"STATIC";
static const wchar_t* CT_LISTBOX = L"LISTBOX";
static const wchar_t* CT_COMBOBOX = L"COMBOBOX";

// ==================== Data Structures ====================

struct NativeControl {
    HWND hwnd;
    int ctrlId;
    std::string name;
    std::string type;
};

struct NativeWindow {
    HWND hwnd;
    DWORD threadId;
    std::thread* workerThread;
    int windowId;
    std::map<int, NativeControl> controls;
    int nextCtrlId;
    bool ready;
    std::mutex readyMutex;
    std::condition_variable readyCV;
    std::mutex controlsMutex;

    NativeWindow() : hwnd(NULL), threadId(0), workerThread(nullptr),
                     windowId(0), nextCtrlId(100), ready(false) {}
};

// ==================== Global State ====================
static std::map<int, NativeWindow*> g_windows;
static int g_nextWindowId = 1;
static std::mutex g_mutex;

struct EventPayload {
    int windowId;
    int ctrlId;
    std::string eventType;
    std::string data;
};

static Napi::ThreadSafeFunction g_tsfn;

// ==================== UTF-8 / Wide String Conversion ====================
static std::wstring toWide(const std::string& s) {
    if (s.empty()) return L"";
    int len = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, NULL, 0);
    std::wstring ws(len - 1, 0);
    MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, &ws[0], len);
    return ws;
}

static std::string toUtf8(const wchar_t* ws) {
    if (!ws) return "";
    int len = WideCharToMultiByte(CP_UTF8, 0, ws, -1, NULL, 0, NULL, NULL);
    std::string s(len - 1, 0);
    WideCharToMultiByte(CP_UTF8, 0, ws, -1, &s[0], len, NULL, NULL);
    return s;
}

// ==================== Event Dispatch ====================

static void dispatchEvent(int windowId, int ctrlId,
                          const std::string& eventType,
                          const std::string& data) {
    auto* payload = new EventPayload{windowId, ctrlId, eventType, data};
    g_tsfn.NonBlockingCall(payload, [](Napi::Env env, Napi::Function jsCallback, EventPayload* p) {
        if (!p) return;
        jsCallback.Call({
            Napi::Number::New(env, p->windowId),
            Napi::Number::New(env, p->ctrlId),
            Napi::String::New(env, p->eventType),
            Napi::String::New(env, p->data)
        });
        delete p;
    });
}

// ==================== Window Procedure ====================

static LRESULT CALLBACK NativeWndProc(HWND hwnd, UINT msg,
                                       WPARAM wParam, LPARAM lParam) {
    NativeWindow* nw = nullptr;

    if (msg == WM_CREATE) {
        auto* cs = reinterpret_cast<CREATESTRUCTW*>(lParam);
        nw = static_cast<NativeWindow*>(cs->lpCreateParams);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(nw));
    } else {
        nw = reinterpret_cast<NativeWindow*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    }

    if (!nw) return DefWindowProcW(hwnd, msg, wParam, lParam);

    switch (msg) {
    case WM_COMMAND: {
        int ctrlId = LOWORD(wParam);
        int notifyCode = HIWORD(wParam);
        HWND ctrlHwnd = reinterpret_cast<HWND>(lParam);

        std::lock_guard<std::mutex> lock(nw->controlsMutex);
        auto it = nw->controls.find(ctrlId);
        if (it == nw->controls.end()) break;

        const auto& ctrl = it->second;

        if (ctrl.type == "button" && notifyCode == BN_CLICKED) {
            dispatchEvent(nw->windowId, ctrlId, "click", ctrl.name);
        }
        else if (ctrl.type == "input" && notifyCode == EN_CHANGE) {
            dispatchEvent(nw->windowId, ctrlId, "change", ctrl.name);
        }
        else if (ctrl.type == "list" && notifyCode == LBN_SELCHANGE) {
            dispatchEvent(nw->windowId, ctrlId, "select", ctrl.name);
        }
        break;
    }
    case WM_CLOSE:
        DestroyWindow(hwnd);
        return 0;
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

// (Dead WindowThreadProc removed - JsCreateWindow handles everything)

// ==================== N-API Functions ====================

static Napi::Value Init(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsFunction()) {
        Napi::TypeError::New(env, "Expected callback function").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    // Create threadsafe function for event dispatch
    Napi::Function callback = info[0].As<Napi::Function>();
    g_tsfn = Napi::ThreadSafeFunction::New(
        env,
        callback,
        "NativeEvent",
        0,  // unlimited queue
        1   // 1 thread
    );

    // Initialize common controls
    INITCOMMONCONTROLSEX icc = {};
    icc.dwSize = sizeof(icc);
    icc.dwICC = ICC_STANDARD_CLASSES;
    InitCommonControlsEx(&icc);

    return Napi::Boolean::New(env, true);
}

static Napi::Value JsCreateWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Expected config object").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Object config = info[0].As<Napi::Object>();

    // Create NativeWindow struct
    NativeWindow* nw = new NativeWindow();
    nw->windowId = g_nextWindowId++;

    // Pass config to thread via a temporary struct
    struct CreateParams {
        int width, height;
        std::wstring title;
        std::wstring iconPath;
    };
    CreateParams params;
    params.width = config.Has("width") ? config.Get("width").As<Napi::Number>().Int32Value() : 800;
    params.height = config.Has("height") ? config.Get("height").As<Napi::Number>().Int32Value() : 600;
    params.title = config.Has("title")
        ? toWide(config.Get("title").As<Napi::String>().Utf8Value())
        : L"Test Window";
    params.iconPath = config.Has("icon")
        ? toWide(config.Get("icon").As<Napi::String>().Utf8Value())
        : L"";

    // Store params in the NativeWindow for the thread to read
    // (We'll use a simpler approach: set title after creation)
    nw->windowId;

    {
        std::lock_guard<std::mutex> lock(g_mutex);
        g_windows[nw->windowId] = nw;
    }

    // Create worker thread
    nw->workerThread = new std::thread([nw, params]() {
        // Register window class
        WNDCLASSEXW wc = {};
        wc.cbSize = sizeof(wc);
        wc.lpfnWndProc = NativeWndProc;
        wc.hInstance = GetModuleHandleW(NULL);
        wc.hCursor = LoadCursor(NULL, IDC_ARROW);
        wc.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_BTNFACE + 1);
        wc.lpszClassName = L"ObjectScratchAppWnd";
        // Unregister existing class to allow re-registration with new icon
        UnregisterClassW(L"ObjectScratchAppWnd", GetModuleHandleW(NULL));
        // Load custom icon if specified, otherwise use default
        HICON hIcon = NULL;
        HICON hIconSm = NULL;
        if (!params.iconPath.empty()) {
            hIcon = (HICON)LoadImageW(NULL, params.iconPath.c_str(), IMAGE_ICON, 32, 32, LR_LOADFROMFILE);
            hIconSm = (HICON)LoadImageW(NULL, params.iconPath.c_str(), IMAGE_ICON, 16, 16, LR_LOADFROMFILE);
        }
        if (!hIcon) hIcon = LoadIcon(NULL, IDI_APPLICATION);
        if (!hIconSm) hIconSm = hIcon;
        wc.hIcon = hIcon;
        wc.hIconSm = hIconSm;
        RegisterClassExW(&wc);

        int screenW = GetSystemMetrics(SM_CXSCREEN);
        int screenH = GetSystemMetrics(SM_CYSCREEN);
        int posX = (screenW - params.width) / 2;
        int posY = (screenH - params.height) / 2;

        nw->hwnd = CreateWindowExW(
            WS_EX_APPWINDOW,
            L"ObjectScratchAppWnd",
            params.title.c_str(),
            WS_OVERLAPPEDWINDOW,
            posX, posY, params.width, params.height,
            NULL, NULL,
            GetModuleHandleW(NULL),
            nw
        );

        if (!nw->hwnd) {
            std::lock_guard<std::mutex> lock(nw->readyMutex);
            nw->ready = true;
            nw->readyCV.notify_all();
            return;
        }

        nw->threadId = GetCurrentThreadId();
        // Set window icon explicitly via WM_SETICON (ensures taskbar + title bar icon)
        if (hIcon) SendMessageW(nw->hwnd, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(hIcon));
        if (hIconSm) SendMessageW(nw->hwnd, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(hIconSm));
        ShowWindow(nw->hwnd, SW_SHOW);
        UpdateWindow(nw->hwnd);

        {
            std::lock_guard<std::mutex> lock(nw->readyMutex);
            nw->ready = true;
        }
        nw->readyCV.notify_all();

        MSG msg;
        while (GetMessage(&msg, NULL, 0, 0)) {
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }

        dispatchEvent(nw->windowId, 0, "close", "");

        {
            std::lock_guard<std::mutex> lock(g_mutex);
            g_windows.erase(nw->windowId);
        }
        delete nw;
    });

    // Wait for window to be ready
    {
        std::unique_lock<std::mutex> lock(nw->readyMutex);
        nw->readyCV.wait(lock, [nw] { return nw->ready; });
    }

    if (!nw->hwnd) {
        Napi::Error::New(env, "Failed to create native window").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    return Napi::Number::New(env, nw->windowId);
}

static Napi::Value AddControl(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsObject()) {
        Napi::TypeError::New(env, "Expected (windowId, config)").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int windowId = info[0].As<Napi::Number>().Int32Value();
    Napi::Object config = info[1].As<Napi::Object>();

    NativeWindow* nw = nullptr;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto it = g_windows.find(windowId);
        if (it == g_windows.end()) {
            Napi::Error::New(env, "Window not found").ThrowAsJavaScriptException();
            return env.Undefined();
        }
        nw = it->second;
    }

    // Parse control config
    std::string type = config.Has("type")
        ? config.Get("type").As<Napi::String>().Utf8Value() : "label";
    std::string name = config.Has("name")
        ? config.Get("name").As<Napi::String>().Utf8Value() : "";
    std::string text = config.Has("text")
        ? config.Get("text").As<Napi::String>().Utf8Value() : name;
    int x = config.Has("x") ? config.Get("x").As<Napi::Number>().Int32Value() : 10;
    int y = config.Has("y") ? config.Get("y").As<Napi::Number>().Int32Value() : 10;
    int w = config.Has("width") ? config.Get("width").As<Napi::Number>().Int32Value() : 0;
    int h = config.Has("height") ? config.Get("height").As<Napi::Number>().Int32Value() : 0;
    std::string defaultValue = config.Has("defaultValue")
        ? config.Get("defaultValue").As<Napi::String>().Utf8Value() : "";

    // Determine Win32 control properties
    const wchar_t* className;
    DWORD style = WS_CHILD | WS_VISIBLE;
    std::wstring wText;
    int defW = 120, defH = 28;

    if (type == "button") {
        className = CT_BUTTON;
        style |= BS_PUSHBUTTON | WS_TABSTOP;
        wText = toWide(text);
        defW = 120; defH = 32;
    } else if (type == "input") {
        className = CT_EDIT;
        style |= ES_AUTOHSCROLL | WS_BORDER | WS_TABSTOP;
        wText = toWide(defaultValue);
        defW = 200; defH = 28;
    } else if (type == "label") {
        className = CT_STATIC;
        style |= SS_LEFT;
        wText = toWide(text);
        defW = 200; defH = 20;
    } else if (type == "list") {
        className = CT_LISTBOX;
        style |= LBS_NOTIFY | WS_VSCROLL | WS_BORDER | LBS_HASSTRINGS;
        wText = L"";
        defW = 200; defH = 150;
    } else if (type == "image") {
        className = CT_STATIC;
        style |= SS_BITMAP | SS_CENTERIMAGE;
        wText = toWide("[Image] " + name);
        defW = 120; defH = 120;
    } else {
        className = CT_STATIC;
        wText = toWide(name);
        defW = 100; defH = 20;
    }

    if (w <= 0) w = defW;
    if (h <= 0) h = defH;

    // Create the control on the native thread
    // We need to marshal this to the window thread
    struct CreateCtrlParams {
        const wchar_t* className;
        std::wstring text;
        DWORD style;
        int x, y, w, h;
        int ctrlId;
        HWND result;
        std::mutex mutex;
        std::condition_variable cv;
        bool done;
        CreateCtrlParams() : className(nullptr), style(0), x(0), y(0),
                             w(0), h(0), ctrlId(0), result(NULL), done(false) {}
    };

    int ctrlId;
    {
        std::lock_guard<std::mutex> lock(nw->controlsMutex);
        ctrlId = nw->nextCtrlId++;
    }

    // Create control directly (PostMessage won't work for CreateWindow)
    // Instead, use SendMessage with a custom approach:
    // We'll create the control from the JS thread using PostMessage
    // Actually, CreateWindow can be called from any thread as long as
    // the parent window handle is valid. The control will be owned by
    // the parent window's thread.

    HWND ctrlHwnd = CreateWindowExW(
        0,
        className,
        wText.c_str(),
        style,
        x, y, w, h,
        nw->hwnd,
        reinterpret_cast<HMENU>(static_cast<intptr_t>(ctrlId)),
        GetModuleHandleW(NULL),
        NULL
    );

    if (!ctrlHwnd) {
        Napi::Error::New(env, "Failed to create control").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    // Set default font
    HFONT hFont = reinterpret_cast<HFONT>(GetStockObject(DEFAULT_GUI_FONT));
    SendMessageW(ctrlHwnd, WM_SETFONT, reinterpret_cast<WPARAM>(hFont), TRUE);

    // Register the control
    {
        std::lock_guard<std::mutex> lock(nw->controlsMutex);
        NativeControl ctrl;
        ctrl.hwnd = ctrlHwnd;
        ctrl.ctrlId = ctrlId;
        ctrl.name = name;
        ctrl.type = type;
        nw->controls[ctrlId] = ctrl;
    }

    return Napi::Number::New(env, ctrlId);
}

static Napi::Value SetProperty(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 4 || !info[0].IsNumber() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Expected (windowId, ctrlId, prop, value)")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int windowId = info[0].As<Napi::Number>().Int32Value();
    int ctrlId = info[1].As<Napi::Number>().Int32Value();
    std::string prop = info[2].As<Napi::String>().Utf8Value();
    std::string value = info[3].IsString()
        ? info[3].As<Napi::String>().Utf8Value()
        : info[3].ToString().Utf8Value();

    NativeWindow* nw = nullptr;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto it = g_windows.find(windowId);
        if (it == g_windows.end()) return Napi::Boolean::New(env, false);
        nw = it->second;
    }

    HWND ctrlHwnd = NULL;
    {
        std::lock_guard<std::mutex> lock(nw->controlsMutex);
        auto it = nw->controls.find(ctrlId);
        if (it == nw->controls.end()) return Napi::Boolean::New(env, false);
        ctrlHwnd = it->second.hwnd;
    }

    if (!ctrlHwnd) return Napi::Boolean::New(env, false);

    if (prop == "text") {
        std::wstring wText = toWide(value);
        SetWindowTextW(ctrlHwnd, wText.c_str());
    } else if (prop == "x" || prop == "y") {
        RECT rc;
        GetWindowRect(ctrlHwnd, &rc);
        POINT pt = { rc.left, rc.top };
        ScreenToClient(nw->hwnd, &pt);
        int newX = (prop == "x") ? std::stoi(value) : pt.x;
        int newY = (prop == "y") ? std::stoi(value) : pt.y;
        int w = rc.right - rc.left;
        int h = rc.bottom - rc.top;
        SetWindowPos(ctrlHwnd, NULL, newX, newY, w, h,
                     SWP_NOZORDER | SWP_NOACTIVATE);
    } else if (prop == "width" || prop == "height") {
        RECT rc;
        GetWindowRect(ctrlHwnd, &rc);
        POINT pt = { rc.left, rc.top };
        ScreenToClient(nw->hwnd, &pt);
        int newW = (prop == "width") ? std::stoi(value) : (rc.right - rc.left);
        int newH = (prop == "height") ? std::stoi(value) : (rc.bottom - rc.top);
        SetWindowPos(ctrlHwnd, NULL, pt.x, pt.y, newW, newH,
                     SWP_NOZORDER | SWP_NOACTIVATE);
    } else if (prop == "enabled") {
        EnableWindow(ctrlHwnd, value != "false" && value != "0");
    } else if (prop == "visible") {
        ShowWindow(ctrlHwnd, (value != "false" && value != "0") ? SW_SHOW : SW_HIDE);
    } else if (prop == "value") {
        SetWindowTextW(ctrlHwnd, toWide(value).c_str());
    }

    return Napi::Boolean::New(env, true);
}

static Napi::Value GetProperty(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3 || !info[0].IsNumber() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Expected (windowId, ctrlId, prop)")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int windowId = info[0].As<Napi::Number>().Int32Value();
    int ctrlId = info[1].As<Napi::Number>().Int32Value();
    std::string prop = info[2].As<Napi::String>().Utf8Value();

    NativeWindow* nw = nullptr;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto it = g_windows.find(windowId);
        if (it == g_windows.end()) return env.Null();
        nw = it->second;
    }

    HWND ctrlHwnd = NULL;
    std::string ctrlType, ctrlName;
    {
        std::lock_guard<std::mutex> lock(nw->controlsMutex);
        auto it = nw->controls.find(ctrlId);
        if (it == nw->controls.end()) return env.Null();
        ctrlHwnd = it->second.hwnd;
        ctrlType = it->second.type;
        ctrlName = it->second.name;
    }

    if (!ctrlHwnd) return env.Null();

    if (prop == "text") {
        int len = GetWindowTextLengthW(ctrlHwnd);
        std::wstring ws(len + 1, 0);
        GetWindowTextW(ctrlHwnd, &ws[0], len + 1);
        ws.resize(len);
        return Napi::String::New(env, toUtf8(ws.c_str()));
    } else if (prop == "value") {
        int len = GetWindowTextLengthW(ctrlHwnd);
        std::wstring ws(len + 1, 0);
        GetWindowTextW(ctrlHwnd, &ws[0], len + 1);
        ws.resize(len);
        return Napi::String::New(env, toUtf8(ws.c_str()));
    } else if (prop == "x" || prop == "y") {
        RECT rc;
        GetWindowRect(ctrlHwnd, &rc);
        POINT pt = { rc.left, rc.top };
        ScreenToClient(nw->hwnd, &pt);
        return Napi::Number::New(env, (prop == "x") ? pt.x : pt.y);
    } else if (prop == "width" || prop == "height") {
        RECT rc;
        GetWindowRect(ctrlHwnd, &rc);
        return Napi::Number::New(env,
            (prop == "width") ? (rc.right - rc.left) : (rc.bottom - rc.top));
    } else if (prop == "enabled") {
        return Napi::Boolean::New(env, IsWindowEnabled(ctrlHwnd) != 0);
    } else if (prop == "visible") {
        return Napi::Boolean::New(env, IsWindowVisible(ctrlHwnd) != 0);
    } else if (prop == "name") {
        return Napi::String::New(env, ctrlName);
    } else if (prop == "type") {
        return Napi::String::New(env, ctrlType);
    } else if (prop == "listSelected") {
        // For listbox: get selected text
        int sel = static_cast<int>(SendMessageW(ctrlHwnd, LB_GETCURSEL, 0, 0));
        if (sel == LB_ERR) return Napi::String::New(env, "");
        int len = static_cast<int>(SendMessageW(ctrlHwnd, LB_GETTEXTLEN, sel, 0));
        if (len == LB_ERR) return Napi::String::New(env, "");
        std::wstring ws(len + 1, 0);
        SendMessageW(ctrlHwnd, LB_GETTEXT, sel, reinterpret_cast<LPARAM>(&ws[0]));
        ws.resize(len);
        return Napi::String::New(env, toUtf8(ws.c_str()));
    }

    return env.Null();
}

static Napi::Value ListAddItem(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 3) return Napi::Boolean::New(env, false);

    int windowId = info[0].As<Napi::Number>().Int32Value();
    int ctrlId = info[1].As<Napi::Number>().Int32Value();
    std::string item = info[2].As<Napi::String>().Utf8Value();

    NativeWindow* nw = nullptr;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto it = g_windows.find(windowId);
        if (it == g_windows.end()) return Napi::Boolean::New(env, false);
        nw = it->second;
    }

    HWND ctrlHwnd = NULL;
    {
        std::lock_guard<std::mutex> lock(nw->controlsMutex);
        auto it = nw->controls.find(ctrlId);
        if (it == nw->controls.end()) return Napi::Boolean::New(env, false);
        ctrlHwnd = it->second.hwnd;
    }

    std::wstring wItem = toWide(item);
    SendMessageW(ctrlHwnd, LB_ADDSTRING, 0,
                 reinterpret_cast<LPARAM>(wItem.c_str()));
    return Napi::Boolean::New(env, true);
}

static Napi::Value ListClear(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2) return Napi::Boolean::New(env, false);

    int windowId = info[0].As<Napi::Number>().Int32Value();
    int ctrlId = info[1].As<Napi::Number>().Int32Value();

    NativeWindow* nw = nullptr;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto it = g_windows.find(windowId);
        if (it == g_windows.end()) return Napi::Boolean::New(env, false);
        nw = it->second;
    }

    HWND ctrlHwnd = NULL;
    {
        std::lock_guard<std::mutex> lock(nw->controlsMutex);
        auto it = nw->controls.find(ctrlId);
        if (it == nw->controls.end()) return Napi::Boolean::New(env, false);
        ctrlHwnd = it->second.hwnd;
    }

    SendMessageW(ctrlHwnd, LB_RESETCONTENT, 0, 0);
    return Napi::Boolean::New(env, true);
}

static Napi::Value DestroyWindowNative(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsNumber()) {
        return Napi::Boolean::New(env, false);
    }

    int windowId = info[0].As<Napi::Number>().Int32Value();

    NativeWindow* nw = nullptr;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto it = g_windows.find(windowId);
        if (it == g_windows.end()) return Napi::Boolean::New(env, false);
        nw = it->second;
    }

    if (nw->hwnd) {
        PostMessageW(nw->hwnd, WM_CLOSE, 0, 0);
    }

    return Napi::Boolean::New(env, true);
}

static Napi::Value SetWindowTitle(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2) return Napi::Boolean::New(env, false);

    int windowId = info[0].As<Napi::Number>().Int32Value();
    std::string title = info[1].As<Napi::String>().Utf8Value();

    NativeWindow* nw = nullptr;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto it = g_windows.find(windowId);
        if (it == g_windows.end()) return Napi::Boolean::New(env, false);
        nw = it->second;
    }

    if (nw->hwnd) {
        std::wstring wTitle = toWide(title);
        SetWindowTextW(nw->hwnd, wTitle.c_str());
    }
    return Napi::Boolean::New(env, true);
}

static Napi::Value IsAvailable(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), true);
}

// ==================== Module Init ====================

Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
    exports.Set("init", Napi::Function::New(env, Init));
    exports.Set("createWindow", Napi::Function::New(env, JsCreateWindow));
    exports.Set("addControl", Napi::Function::New(env, AddControl));
    exports.Set("setProperty", Napi::Function::New(env, SetProperty));
    exports.Set("getProperty", Napi::Function::New(env, GetProperty));
    exports.Set("listAddItem", Napi::Function::New(env, ListAddItem));
    exports.Set("listClear", Napi::Function::New(env, ListClear));
    exports.Set("destroyWindow", Napi::Function::New(env, DestroyWindowNative));
    exports.Set("setWindowTitle", Napi::Function::New(env, SetWindowTitle));
    exports.Set("isAvailable", Napi::Function::New(env, IsAvailable));
    return exports;
}

NODE_API_MODULE(app_runtime, InitModule)
