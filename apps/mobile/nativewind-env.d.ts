/// <reference types="nativewind/types" />

// global.css 不输出任何 JS 符号，只是一个 side-effect import：
// NativeWind 的 Metro transform 读它生成样式表，运行时导入本身不返回值。
// tsc --noEmit 下需要这个 ambient 声明，否则 `import "../../global.css"` 报 TS2882。
declare module "*.css";
