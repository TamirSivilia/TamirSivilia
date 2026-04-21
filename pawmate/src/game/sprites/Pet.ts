import Phaser from 'phaser';
import { getAnimalDef } from '@/data/animals.ts';
import type { Species } from '@/data/animals.ts';

export type PetMood = 'happy' | 'neutral' | 'sad' | 'hungry' | 'tired' | 'sleeping';

export class PetSprite extends Phaser.GameObjects.Container {
  private bodyGfx!: Phaser.GameObjects.Graphics;
  private eyes!: Phaser.GameObjects.Graphics;
  private ears!: Phaser.GameObjects.Graphics;
  private tail!: Phaser.GameObjects.Graphics;
  private speechBubble!: Phaser.GameObjects.Container;
  private speechText!: Phaser.GameObjects.Text;
  private mood: PetMood = 'neutral';
  private species: Species;
  private petColor: number;
  private accentColor: number;
  private idleTween?: Phaser.Tweens.Tween;
  private earTween?: Phaser.Tweens.Tween;
  private tailTween?: Phaser.Tweens.Tween;
  private blinkTimer?: Phaser.Time.TimerEvent;
  private onTapCallback?: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, species: Species) {
    super(scene, x, y);
    this.species = species;
    const def = getAnimalDef(species);
    this.petColor = def.color;
    this.accentColor = def.accentColor;

    this.buildSprite();
    this.startIdleAnimations();
    // Cast needed: Phaser types Container as GameObject in add.existing
    (scene.add as Phaser.GameObjects.GameObjectFactory).existing(this as unknown as Phaser.GameObjects.GameObject);
    this.setSize(120, 120);
    this.setInteractive();
    this.on('pointerdown', () => this.onTapCallback?.());
  }

  private buildSprite() {
    this.ears = this.scene.add.graphics();
    this.bodyGfx = this.scene.add.graphics();
    this.eyes = this.scene.add.graphics();
    this.tail = this.scene.add.graphics();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any

    this.add([this.tail, this.ears, this.bodyGfx, this.eyes]);

    this.drawPet();
    this.buildSpeechBubble();
  }

  private drawPet() {
    this.bodyGfx.clear();
    this.ears.clear();
    this.eyes.clear();
    this.tail.clear();

    switch (this.species) {
      case 'dog': this.drawDog(); break;
      case 'cat': this.drawCat(); break;
      case 'rabbit': this.drawRabbit(); break;
      default: this.drawDog();
    }
  }

  private drawDog() {
    // Ears
    this.ears.fillStyle(this.accentColor);
    this.ears.fillEllipse(-32, -45, 28, 40);
    this.ears.fillEllipse(32, -45, 28, 40);

    // Body
    this.bodyGfx.fillStyle(this.petColor);
    this.bodyGfx.fillEllipse(0, 0, 100, 90);

    // Head (slightly above body center)
    this.bodyGfx.fillEllipse(0, -20, 80, 75);

    // Snout
    this.bodyGfx.fillStyle(this.accentColor);
    this.bodyGfx.fillEllipse(0, 10, 32, 24);

    // Nose
    this.bodyGfx.fillStyle(0x1a1a1a);
    this.bodyGfx.fillEllipse(0, 4, 14, 10);

    // Eyes (drawn separately for animation)
    this.drawEyes();

    // Tail
    this.tail.fillStyle(this.petColor);
    this.tail.fillEllipse(55, 20, 18, 40);
  }

  private drawCat() {
    // Ears (pointy)
    this.ears.fillStyle(this.petColor);
    this.ears.fillTriangle(-38, -50, -20, -78, -6, -50);
    this.ears.fillTriangle(38, -50, 20, -78, 6, -50);
    // Inner ear
    this.ears.fillStyle(0xffb6c1);
    this.ears.fillTriangle(-32, -52, -22, -70, -12, -52);
    this.ears.fillTriangle(32, -52, 22, -70, 12, -52);

    // Body
    this.bodyGfx.fillStyle(this.petColor);
    this.bodyGfx.fillEllipse(0, 5, 90, 80);
    this.bodyGfx.fillEllipse(0, -22, 75, 72);

    // Snout
    this.bodyGfx.fillStyle(0xfff5e6);
    this.bodyGfx.fillEllipse(0, 8, 28, 20);

    // Nose
    this.bodyGfx.fillStyle(0xff9999);
    this.bodyGfx.fillTriangle(0, 0, -6, 8, 6, 8);

    this.drawEyes();

    // Tail
    this.tail.fillStyle(this.petColor);
    this.tail.fillEllipse(60, 15, 16, 50);
  }

  private drawRabbit() {
    // Long ears
    this.ears.fillStyle(this.petColor);
    this.ears.fillEllipse(-22, -68, 20, 55);
    this.ears.fillEllipse(22, -68, 20, 55);
    // Inner ear
    this.ears.fillStyle(0xffb6c1);
    this.ears.fillEllipse(-22, -68, 10, 42);
    this.ears.fillEllipse(22, -68, 10, 42);

    // Body
    this.bodyGfx.fillStyle(this.petColor);
    this.bodyGfx.fillEllipse(0, 12, 88, 76);
    this.bodyGfx.fillEllipse(0, -18, 72, 68);

    // Snout
    this.bodyGfx.fillStyle(0xfff0f0);
    this.bodyGfx.fillEllipse(0, 6, 26, 18);

    // Nose
    this.bodyGfx.fillStyle(0xffaaaa);
    this.bodyGfx.fillEllipse(0, 2, 10, 8);

    this.drawEyes();

    // Fluffy tail
    this.tail.fillStyle(0xffffff);
    this.tail.fillCircle(48, 20, 12);
  }

  private drawEyes() {
    this.eyes.fillStyle(0xffffff);
    this.eyes.fillCircle(-16, -26, 10);
    this.eyes.fillCircle(16, -26, 10);
    this.eyes.fillStyle(0x1a1a1a);
    this.eyes.fillCircle(-15, -26, 6);
    this.eyes.fillCircle(17, -26, 6);
    // Shine
    this.eyes.fillStyle(0xffffff);
    this.eyes.fillCircle(-13, -28, 2);
    this.eyes.fillCircle(19, -28, 2);
  }

  private blink() {
    this.eyes.clear();
    // Closed eyes (lines)
    this.eyes.lineStyle(3, 0x1a1a1a);
    this.eyes.strokeEllipse(-15, -26, 16, 4);
    this.eyes.strokeEllipse(17, -26, 16, 4);
    this.scene.time.delayedCall(150, () => {
      this.eyes.clear();
      this.drawEyes();
    });
  }

  private buildSpeechBubble() {
    this.speechBubble = this.scene.add.container(0, -110);
    this.speechBubble.setAlpha(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0xffffff, 0.95);
    bg.fillRoundedRect(-70, -20, 140, 40, 12);
    // Pointer
    bg.fillTriangle(-10, 20, 10, 20, 0, 32);

    this.speechText = this.scene.add.text(0, 0, '', {
      fontFamily: 'Rubik, sans-serif',
      fontSize: '13px',
      color: '#1a1a2e',
      align: 'center',
    }).setOrigin(0.5);

    this.speechBubble.add([bg, this.speechText]);
    this.add(this.speechBubble);
  }

  showSpeech(text: string, durationMs = 3000) {
    this.speechText.setText(text);
    this.scene.tweens.add({
      targets: this.speechBubble,
      alpha: 1,
      duration: 200,
    });
    this.scene.time.delayedCall(durationMs, () => {
      this.scene.tweens.add({
        targets: this.speechBubble,
        alpha: 0,
        duration: 300,
      });
    });
  }

  private startIdleAnimations() {
    // Breathing idle
    this.idleTween = this.scene.tweens.add({
      targets: this,
      scaleY: 1.04,
      scaleX: 0.97,
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Ear twitch
    this.earTween = this.scene.tweens.add({
      targets: this.ears,
      angle: 5,
      duration: 300,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      repeatDelay: 3000,
    });

    // Tail wag
    this.tailTween = this.scene.tweens.add({
      targets: this.tail,
      angle: 20,
      duration: 400,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      repeatDelay: 800,
    });

    // Blink every 3-5 seconds
    this.blinkTimer = this.scene.time.addEvent({
      delay: 3000 + Math.random() * 2000,
      callback: this.blink,
      callbackScope: this,
      loop: true,
    });
  }

  setMood(mood: PetMood) {
    if (this.mood === mood) return;
    this.mood = mood;

    // Adjust tween speeds based on mood
    if (mood === 'happy') {
      this.tailTween?.updateTo('repeatDelay', 200);
      this.tailTween?.updateTo('duration', 200);
    } else if (mood === 'sad' || mood === 'hungry') {
      this.tailTween?.stop();
      this.scene.tweens.add({ targets: this, alpha: 0.75, duration: 500 });
    } else if (mood === 'sleeping') {
      this.idleTween?.stop();
      this.scene.tweens.add({ targets: this, scaleX: 0.95, scaleY: 0.88, duration: 500 });
    } else {
      this.scene.tweens.add({ targets: this, alpha: 1, duration: 300 });
    }
  }

  playHappyJump() {
    this.scene.tweens.add({
      targets: this,
      y: this.y - 30,
      duration: 200,
      ease: 'Power2',
      yoyo: true,
    });
  }

  setOnTap(callback: () => void) {
    this.onTapCallback = callback;
  }

  destroy(fromScene?: boolean) {
    this.idleTween?.stop();
    this.earTween?.stop();
    this.tailTween?.stop();
    this.blinkTimer?.destroy();
    super.destroy(fromScene);
  }
}
