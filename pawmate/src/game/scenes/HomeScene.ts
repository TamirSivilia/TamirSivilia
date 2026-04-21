import Phaser from 'phaser';
import { PetSprite } from '../sprites/Pet.ts';
import { usePetStore } from '@/store/petStore.ts';
import { useUIStore } from '@/store/uiStore.ts';
import { useEconomyStore } from '@/store/economyStore.ts';
import { TAP_PET_COOLDOWN_MS, STAT_DANGER_THRESHOLD } from '@/data/constants.ts';
import { t } from '@/lib/i18n.ts';
import type { PetMood } from '../sprites/Pet.ts';

export class HomeScene extends Phaser.Scene {
  private petSprite?: PetSprite;
  private lastTapMs = 0;
  private roomBg!: Phaser.GameObjects.Graphics;
  private particles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private statSyncTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'HomeScene' });
  }

  create() {
    this.drawRoom();
    this.spawnPet();
    this.startStatSync();

    // Listen for scene switch to WalkScene
    this.events.on('shutdown', this.cleanup, this);
  }

  private drawRoom() {
    const { width, height } = this.cameras.main;
    this.roomBg = this.add.graphics();

    // Floor
    this.roomBg.fillStyle(0x2d3561);
    this.roomBg.fillRect(0, 0, width, height);

    // Back wall
    this.roomBg.fillStyle(0x1e2347);
    this.roomBg.fillRect(0, 0, width, height * 0.55);

    // Floor gradient strip
    this.roomBg.fillStyle(0x3d4878);
    this.roomBg.fillRect(0, height * 0.55, width, 6);

    // Window
    this.roomBg.lineStyle(3, 0x4a5a8a);
    this.roomBg.fillStyle(0x87ceeb, 0.3);
    this.roomBg.fillRoundedRect(width * 0.6, 30, 100, 80, 8);
    this.roomBg.strokeRoundedRect(width * 0.6, 30, 100, 80, 8);
    // Window cross
    this.roomBg.lineStyle(2, 0x4a5a8a);
    this.roomBg.lineBetween(width * 0.6 + 50, 30, width * 0.6 + 50, 110);
    this.roomBg.lineBetween(width * 0.6, 70, width * 0.6 + 100, 70);

    // Rug
    this.roomBg.fillStyle(0x7c3aed, 0.5);
    this.roomBg.fillEllipse(width / 2, height * 0.72, 260, 60);
    this.roomBg.fillStyle(0x9f67fa, 0.3);
    this.roomBg.fillEllipse(width / 2, height * 0.72, 200, 44);

    // Decorative plant (left)
    this.roomBg.fillStyle(0x4a7c59);
    this.roomBg.fillCircle(30, height * 0.52, 22);
    this.roomBg.fillCircle(50, height * 0.48, 18);
    this.roomBg.fillStyle(0x6b5a3e);
    this.roomBg.fillRect(36, height * 0.54, 10, 30);
  }

  private spawnPet() {
    const { width, height } = this.cameras.main;
    const petState = usePetStore.getState().pet;
    if (!petState) return;

    this.petSprite = new PetSprite(
      this,
      width / 2,
      height * 0.52,
      petState.species
    );

    this.petSprite.setOnTap(() => this.handleTap());
    this.updatePetMood();
  }

  private handleTap() {
    const now = Date.now();
    if (now - this.lastTapMs < TAP_PET_COOLDOWN_MS) {
      useUIStore.getState().addToast(t.misc.rateLimited, 'info', '💕');
      return;
    }
    this.lastTapMs = now;

    // Bond +1 (rate-limited)
    const { pet, updateStats } = usePetStore.getState();
    if (pet) {
      updateStats({ bond: Math.min(100, pet.bond + 1) });
    }

    // Heart particles
    this.spawnHearts();
    this.petSprite?.playHappyJump();
    this.petSprite?.showSpeech(t.pet.speechLove);
    useUIStore.getState().addToast(t.pet.speechLove, 'success', '❤️');
  }

  private spawnHearts() {
    if (!this.petSprite) return;
    const hearts = ['❤️', '💕', '💖', '💗'];
    for (let i = 0; i < 5; i++) {
      const x = this.petSprite.x + Phaser.Math.Between(-40, 40);
      const y = this.petSprite.y - 20;
      const heart = this.add.text(x, y, hearts[Phaser.Math.Between(0, hearts.length - 1)], {
        fontSize: '20px',
      });
      this.tweens.add({
        targets: heart,
        y: y - 80,
        alpha: 0,
        duration: 1000 + Phaser.Math.Between(0, 500),
        ease: 'Power1',
        onComplete: () => heart.destroy(),
        delay: i * 100,
      });
    }
  }

  private updatePetMood() {
    if (!this.petSprite) return;
    const pet = usePetStore.getState().pet;
    if (!pet) return;

    let mood: PetMood = 'neutral';
    if (usePetStore.getState().isSleeping) {
      mood = 'sleeping';
    } else if (pet.hunger < STAT_DANGER_THRESHOLD) {
      mood = 'hungry';
      this.petSprite.showSpeech(t.pet.speechHungry);
    } else if (pet.happiness < STAT_DANGER_THRESHOLD) {
      mood = 'sad';
      this.petSprite.showSpeech(t.pet.speechBored);
    } else if (pet.energy < STAT_DANGER_THRESHOLD) {
      mood = 'tired';
      this.petSprite.showSpeech(t.pet.speechTired);
    } else if (pet.happiness > 70 && pet.hunger > 70) {
      mood = 'happy';
    }

    this.petSprite.setMood(mood);
  }

  private startStatSync() {
    // Update mood every 30 seconds
    this.statSyncTimer = this.time.addEvent({
      delay: 30000,
      callback: this.updatePetMood,
      callbackScope: this,
      loop: true,
    });
  }

  switchToWalk() {
    this.scene.start('WalkScene');
  }

  private cleanup() {
    this.statSyncTimer?.destroy();
    this.particles?.destroy();
  }

  update() {
    // Check if scene should switch
    const uiState = useUIStore.getState();
    if (uiState.currentScene === 'walk') {
      this.scene.start('WalkScene');
    }
  }
}
