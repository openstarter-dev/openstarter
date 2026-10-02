import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AssetDefinition } from "./scene-types";

class AssetManager {
  private loader: GLTFLoader;

  /**
   * 原始 GLTF Scene 缓存
   */
  private cache = new Map<string, THREE.Object3D>();

  /**
   * 正在加载中的 Promise
   *
   * 防止用户快速点击同一个素材，
   * 导致同一个 GLB 被同时请求很多次。
   */
  private loading = new Map<string, Promise<THREE.Object3D>>();

  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * 加载模型。
   *
   * 如果已经加载过，直接返回缓存。
   */
  async load(asset: AssetDefinition): Promise<THREE.Object3D> {
    const cached = this.cache.get(asset.id);

    if (cached) {
      return cached;
    }

    const existingLoading = this.loading.get(asset.id);

    if (existingLoading) {
      return existingLoading;
    }

    const promise = new Promise<THREE.Object3D>((resolve, reject) => {
      this.loader.load(
        asset.url,

        (gltf) => {
          const model = gltf.scene;

          model.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.castShadow = true;
              object.receiveShadow = true;
            }
          });

          this.cache.set(asset.id, model);
          this.loading.delete(asset.id);

          resolve(model);
        },

        undefined,

        (error) => {
          this.loading.delete(asset.id);
          reject(error);
        },
      );
    });

    this.loading.set(asset.id, promise);

    return promise;
  }

  /**
   * 获取已经缓存的模型。
   */
  get(assetId: string) {
    return this.cache.get(assetId);
  }

  /**
   * 是否已经加载。
   */
  has(assetId: string) {
    return this.cache.has(assetId);
  }

  /**
   * 创建一个新的 Scene Object。
   *
   * 注意：
   * 这里 clone 的只是场景对象引用结构。
   * 真正复杂模型后面可以接 SkeletonUtils.clone。
   */
  async createInstance(
    asset: AssetDefinition,
  ): Promise<THREE.Object3D> {
    const original = await this.load(asset);

    const instance = original.clone(true);

    return instance;
  }

  /**
   * 清理某个素材。
   */
  remove(assetId: string) {
    this.cache.delete(assetId);
  }

  /**
   * 清空全部缓存。
   */
  clear() {
    this.cache.clear();
    this.loading.clear();
  }
}

export const assetManager = new AssetManager();