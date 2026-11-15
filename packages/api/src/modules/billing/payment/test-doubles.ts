// 测试替身（test doubles）持有层：vi.mock 工厂与测试文件之间的共享句柄。
// hoisted mock 必须放在独立模块，避免 vi.mock 提升与 import 顺序的初始化竞争。

import { vi } from "vitest";

export const handlePaymentEventMock = vi.fn();
