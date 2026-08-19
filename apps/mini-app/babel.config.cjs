// babel-preset-taro 是 Taro 官方推荐的 babel preset，处理 JSX 转换与小程序适配。
module.exports = {
  presets: [
    [
      "babel-preset-taro",
      {
        framework: "react",
        ts: true,
      },
    ],
  ],
};
