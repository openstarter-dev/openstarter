export interface CloudflareLikeEnv {
  [key: string]: unknown;
}

export declare function tryGetCloudflareEnv(): Promise<CloudflareLikeEnv | undefined>;
