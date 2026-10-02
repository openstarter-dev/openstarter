export type AssetCategory =
  | "plants"
  | "furniture"
  | "hardscape";

export interface AssetDefinition {
  id: string;
  name: string;
  category: AssetCategory;
  url: string;
  thumbnail?: string;

  /**
   * 初始缩放
   */
  scale?: number;

  /**
   * 放到地面时的 Y 偏移
   */
  groundOffset?: number;
}

export interface SceneObject {
  id: string;

  /**
   * 对应 AssetDefinition.id
   */
  assetId: string;

  position: [number, number, number];

  rotation: [number, number, number];

  scale: [number, number, number];
}