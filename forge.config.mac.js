module.exports = {
  packagerConfig: {
    asar: true,
    icon: './Objector2',
    platform: 'darwin',
    arch: 'x64',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],
};
