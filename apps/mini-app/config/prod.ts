import type { UserConfig } from "@tarojs/taro";

const config: UserConfig = {
  mini: {
    postcss: {
      autoprefixer: { enable: true },
      pxtransform: { enable: true, config: {} },
    },
  },
  h5: {},
};

export default config;
