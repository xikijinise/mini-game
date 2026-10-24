import Phaser from 'phaser';

// 收集星星的跳跃小游戏：方向键/A D 移动，空格/上键/W 跳跃，手机上点屏幕左右半边移动、点上半部分跳。
// 所有贴图都用代码生成，不需要任何素材文件。
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.makeTextures();

    this.score = 0;
    this.gameOver = false;

    this.platforms = this.physics.add.staticGroup();
    this.platforms.create(400, 584, 'ground');
    [[600, 440], [120, 320], [700, 250], [380, 180]].forEach(([x, y]) => {
      this.platforms.create(x, y, 'platform');
    });

    this.player = this.physics.add.sprite(100, 450, 'player');
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.platforms);

    this.stars = this.physics.add.group({
      key: 'star',
      repeat: 11,
      setXY: { x: 20, y: 0, stepX: 70 },
    });
    this.stars.children.iterate((star) => star.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8)));
    this.physics.add.collider(this.stars, this.platforms);
    this.physics.add.overlap(this.player, this.stars, this.collectStar, null, this);

    this.bombs = this.physics.add.group();
    this.physics.add.collider(this.bombs, this.platforms);
    this.physics.add.collider(this.player, this.bombs, this.hitBomb, null, this);

    this.scoreText = this.add.text(16, 16, '分数: 0', { fontSize: '28px', color: '#1d1f2b', fontStyle: 'bold' });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,D');
  }

  makeTextures() {
    const g = this.add.graphics();
    g.fillStyle(0x3c8d2f).fillRect(0, 0, 800, 32).generateTexture('ground', 800, 32).clear();
    g.fillStyle(0x8b5a2b).fillRect(0, 0, 200, 24).generateTexture('platform', 200, 24).clear();
    g.fillStyle(0xff6b6b).fillRoundedRect(0, 0, 32, 40, 8).generateTexture('player', 32, 40).clear();
    g.fillStyle(0xffd93d).fillCircle(12, 12, 12).generateTexture('star', 24, 24).clear();
    g.fillStyle(0x222222).fillCircle(10, 10, 10).generateTexture('bomb', 20, 20).destroy();
  }

  update() {
    if (this.gameOver) return;

    const pointer = this.input.activePointer;
    const touchLeft = pointer.isDown && pointer.x < this.scale.width / 2;
    const touchRight = pointer.isDown && pointer.x >= this.scale.width / 2;
    const touchJump = pointer.isDown && pointer.y < this.scale.height / 2;

    if (this.cursors.left.isDown || this.keys.A.isDown || touchLeft) {
      this.player.setVelocityX(-220);
    } else if (this.cursors.right.isDown || this.keys.D.isDown || touchRight) {
      this.player.setVelocityX(220);
    } else {
      this.player.setVelocityX(0);
    }

    const jump = this.cursors.up.isDown || this.cursors.space.isDown || this.keys.W.isDown || touchJump;
    if (jump && this.player.body.blocked.down) {
      this.player.setVelocityY(-560);
    }
  }

  collectStar(player, star) {
    star.disableBody(true, true);
    this.score += 10;
    this.scoreText.setText(`分数: ${this.score}`);

    if (this.stars.countActive(true) === 0) {
      this.stars.children.iterate((s) => s.enableBody(true, s.x, 0, true, true));

      const x = player.x < 400 ? Phaser.Math.Between(400, 800) : Phaser.Math.Between(0, 400);
      const bomb = this.bombs.create(x, 16, 'bomb');
      bomb.setBounce(1);
      bomb.setCollideWorldBounds(true);
      bomb.setVelocity(Phaser.Math.Between(-200, 200), 20);
    }
  }

  hitBomb(player) {
    this.physics.pause();
    player.setTint(0x555555);
    this.gameOver = true;

    this.add.text(400, 280, '游戏结束', { fontSize: '56px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5).setStroke('#1d1f2b', 8);
    this.add.text(400, 350, '点击或按空格重新开始', { fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5).setStroke('#1d1f2b', 6);

    const restart = () => this.scene.restart();
    this.input.once('pointerdown', restart);
    this.input.keyboard.once('keydown-SPACE', restart);
  }
}
