import type { UserConfig } from '@tarojs/taro';

const config: UserConfig = {
  projectName: 'openstarter',
  date: '2026-8-4',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
    375: 2 / 1,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: ['@tarojs/plugin-platform-weapp'],
  defineConstants: {
    API_BASE_URL: JSON.stringify(process.env.OPENSTARTER_API_URL || 'http://localhost:3000'),
  },
  mini: {
    postcss: {
      autoprefixer: { enable: true },
      pxtransform: { enable: true, config: {} },
      url: { enable: true, config: { limit: 1024 } },
      cssModules: { enable: false, config: { namingPattern: 'module' } },
    },
  },
  h5: {
    // h5 端不会用到，但 Taro 需要编译配置存在
    publicPath: '/',
    staticDirectory: 'static',
  },
};

export default config;