import si from 'systeminformation';
import { AIService } from './aiService.js';

export class HealthService {
  constructor(private aiService: AIService, private port: number, private version: string) {}

  getPingResponse() {
    return { status: 'pong', timestamp: new Date().toISOString() };
  }

  async getHealthResponse() {
    const ai = {
      enabled: Boolean(this.aiService.openrouterApiKey),
      model: process.env.DEEPSEEK_MODEL || 'deepseek/deepseek-v3.1-terminus',
      openrouter_api_key: this.aiService.openrouterApiKey ? 'loaded' : 'not_found',
      connection_status: this.aiService.openrouterApiKey ? 'ready' : 'no_api_key'
    } as const;

    const system = await this.getSystemInfo();

    return {
      status: ai.enabled ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: this.version,
      ai,
      server: { uptime: 'running', port: this.port },
      system
    };
  }

  private async getSystemInfo() {
    try {
      const [mem, fsSize, cpuLoad, graphics] = await Promise.all([
        si.mem(),
        si.fsSize(),
        si.currentLoad(),
        si.graphics()
      ]);

      const diskTotal = fsSize.reduce((acc, d) => acc + (d.size || 0), 0);
      const diskUsed = fsSize.reduce((acc, d) => acc + (d.used || 0), 0);
      const diskFree = diskTotal - diskUsed;

      const gpuInfo = (graphics.controllers && graphics.controllers.length > 0)
        ? {
            type: graphics.controllers[0].vendor?.toUpperCase().includes('NVIDIA') ? 'NVIDIA' : graphics.controllers[0].vendor || 'GPU',
            name: graphics.controllers[0].model,
            memory_total: graphics.controllers[0].vram ? `${graphics.controllers[0].vram} MB` : undefined
          }
        : { type: 'CPU', status: 'no_gpu_detected' };

      return {
        memory: {
          total: `${(mem.total / 1024 ** 3).toFixed(1)} GB`,
          used: `${(mem.active / 1024 ** 3).toFixed(1)} GB`,
          free: `${(mem.available / 1024 ** 3).toFixed(1)} GB`,
          percent: `${((mem.active / mem.total) * 100).toFixed(1)}%`
        },
        disk: {
          total: `${(diskTotal / 1024 ** 3).toFixed(1)} GB`,
          used: `${(diskUsed / 1024 ** 3).toFixed(1)} GB`,
          free: `${(diskFree / 1024 ** 3).toFixed(1)} GB`,
          percent: `${((diskUsed / diskTotal) * 100).toFixed(1)}%`
        },
        cpu: {
          count: cpuLoad.cpus?.length || 0,
          usage: `${cpuLoad.currentLoad.toFixed(1)}%`
        },
        gpu: gpuInfo
      };
    } catch (e: any) {
      return {
        memory: { error: String(e) },
        disk: { error: String(e) },
        cpu: { error: String(e) },
        gpu: { error: String(e) }
      };
    }
  }
}


