# installer.nsh - NSIS custom script for Objector shell context menu
# electron-builder will include this in the NSIS installer

!macro customInstall
  ; ========== 右键文件夹 → 做为Objector项目打开 ==========
  ; 注册到 HKCU (当前用户，无需管理员权限)
  WriteRegStr HKCU "Software\Classes\Directory\shell\ObjectorOpen" "" "做为Objector项目打开"
  WriteRegStr HKCU "Software\Classes\Directory\shell\ObjectorOpen" "Icon" "$INSTDIR\Objector.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\ObjectorOpen\command" "" '"$INSTDIR\Objector.exe" "%1"'

  ; ========== 右键 ZIP 文件 → 做为Objector项目打开 ==========
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.zip\shell\ObjectorOpen" "" "做为Objector项目打开"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.zip\shell\ObjectorOpen" "Icon" "$INSTDIR\Objector.exe"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.zip\shell\ObjectorOpen\command" "" '"$INSTDIR\Objector.exe" "%1"'
!macroend

!macro customUnInstall
  ; 卸载时清理注册表
  DeleteRegKey HKCU "Software\Classes\Directory\shell\ObjectorOpen"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.zip\shell\ObjectorOpen"
!macroend
