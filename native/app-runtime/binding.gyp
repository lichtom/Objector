{
  "targets": [{
    "target_name": "app_runtime",
    "sources": ["app_runtime.cc"],
    "include_dirs": [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    "dependencies": [
      "<!(node -p \"require('node-addon-api').gyp\")"
    ],
    "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
    "conditions": [
      ["OS=='win'", {
        "msvs_settings": {
          "VCCLCompilerTool": {
            "AdditionalOptions": ["/std:c++17", "/EHsc"],
            "ExceptionHandling": 0
          }
        },
        "libraries": [
          "user32.lib",
          "gdi32.lib",
          "comctl32.lib",
          "shell32.lib"
        ]
      }]
    ]
  }]
}
