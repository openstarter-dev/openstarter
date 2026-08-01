// NativeWind 4 需要两处接线：babel-preset-expo 的 jsxImportSource 指向 nativewind
// （让 className 传到 RN 组件），以及 nativewind/babel preset。
module.exports = (api) => {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
