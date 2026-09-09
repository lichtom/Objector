module.exports = {
  packagerConfig: {
    asar: true,
    icon: './Objector2',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'Objector',
        authors: 'Objector',
        setupIcon: require('path').resolve(__dirname, 'Objector2.ico'),
        iconUrl: 'file:///' + require('path').resolve(__dirname, 'Objector2.ico').replace(/\\/g, '/'),
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32', 'darwin', 'linux'],
    },
  ],
};
