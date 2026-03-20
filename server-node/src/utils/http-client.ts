/**
 * HTTP 客户端工厂和管理器
 *
 * 本模块提供了统一的 HTTP 客户端创建和管理功能：
 * - 自动 SSL 证书验证
 * - 连接池管理和超时控制
 * - 支持代理环境变量
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as https from 'https';

/**
 * HTTP 客户端类
 */
export class HttpClient {
  private static instance: AxiosInstance | null = null;

  /**
   * 获取 SSL 配置
   */
  private static getSSLConfig(): https.Agent {
    return new https.Agent({
      rejectUnauthorized: true,
      keepAlive: true,
    });
  }

  /**
   * 获取客户端配置
   */
  private static getClientConfig(config?: AxiosRequestConfig): AxiosRequestConfig {
    return {
      timeout: 300000, // 5 分钟
      maxRedirects: 5,
      httpsAgent: HttpClient.getSSLConfig(),
      ...config,
    };
  }

  /**
   * 创建客户端实例
   */
  static create(config?: AxiosRequestConfig): AxiosInstance {
    return axios.create(HttpClient.getClientConfig(config));
  }

  /**
   * 获取单例实例
   */
  static getInstance(): AxiosInstance {
    if (!HttpClient.instance) {
      HttpClient.instance = HttpClient.create();
    }
    return HttpClient.instance;
  }
}