import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.ts';
import { PreloadScene } from './scenes/PreloadScene.ts';
import { HomeScene } from './scenes/HomeScene.ts';
import { WalkScene } from './scenes/minigames/WalkScene.ts';

export function createPhaserConfig(width: number, height: number): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width,
    height,
    backgroundColor: '#1a1a2e',
    parent: 'game-canvas',
    scene: [BootScene, PreloadScene, HomeScene, WalkScene],
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
  };
}
