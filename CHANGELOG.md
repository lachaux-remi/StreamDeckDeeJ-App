# Changelog

## [4.3.0](https://github.com/lachaux-remi/StreamDeckDeeJ-App/compare/v4.2.0...v4.3.0) (2026-10-08)


### Fonctionnalités

* **deej:** show a real-time audio level meter on each slider ([#79](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/79)) ([d908010](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/d908010bbce9157a9ecd05a213e9cb53a9570547))
* **home-assistant:** add automation buttons and attribute LED conditions ([#82](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/82)) ([7e552d9](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/7e552d97d1e404c7b18b40cfd9508436455dc388))
* **home-assistant:** autocomplete services and entities in the button dialog ([#81](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/81)) ([1c0f04b](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/1c0f04b4600894d0fe5ea7e759c6a1e680a20fd1))
* **home-assistant:** update button LEDs live over the WebSocket API ([#80](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/80)) ([39009d2](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/39009d2444f5657dbed576f75022dc375da5ed13))
* **packaging:** serve releases from a signed pacman repository ([#73](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/73)) ([5ad3229](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/5ad3229bb203c59891175ac023507d0f59824a50))
* **updater:** tell pacman users how to install the update ([#77](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/77)) ([196997b](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/196997bf92c67d6f5e9ca470a887263cd9c418a8))


### Corrections de bugs

* **ci:** package Linux release builds and resume failed releases ([#65](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/65)) ([95cdd91](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/95cdd9159817aa4a5cbd7ec0ac0e3855d45fd48f))
* **deps:** remove sprintf-js instead of ignoring its advisory ([#74](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/74)) ([65364b0](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/65364b07ae8321552eaabd42a5312ef6e2175d80))
* **packaging:** declare the actual pacman runtime dependencies ([#67](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/67)) ([f41e89b](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/f41e89ba503bf8a67bcb8ac8e7e1420949ebb4a7))
* **packaging:** rerun the install script on pacman upgrades ([#71](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/71)) ([605012c](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/605012c970ad123fe68d6cf545d2b85708fdb371))
* **updater:** show release notes as readable text ([#70](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/70)) ([1ed6061](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/1ed60614dd3d38f417a4756d8298f653eea43218))

## [4.2.0](https://github.com/lachaux-remi/StreamDeckDeeJ-App/compare/v4.1.0...v4.2.0) (2026-10-06)


### Fonctionnalités

* **electron:** upgrade to Electron 44.5.1 while keeping the Linux tray working on KDE Wayland ([#62](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/62)) ([d5fb45f](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/d5fb45f1a855e0c2196aa663da97cca9ead7c58a))
* **updater:** add verified Windows NSIS updates ([#50](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/50)) ([1c9c5bb](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/1c9c5bbb4d7de9c6105e666fb797e6dd80de0fe5))
* **windows:** add native audio backend ([#49](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/49)) ([884fbf3](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/884fbf338ea088c03a9984171c50b269a55af05a))
* **windows:** add x64 platform foundation ([#48](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/48)) ([9d31f29](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/9d31f2999bb8e36259c1241f3ee5d3a4b45ccb88))


### Corrections de bugs

* **ci:** run release signing from main ([#46](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/46)) ([479bc10](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/479bc1068d6d579031ed421edab0cb1d41f10ced))

## [4.1.0](https://github.com/lachaux-remi/StreamDeckDeeJ-App/compare/v4.0.6...v4.1.0) (2026-08-25)


### Fonctionnalités

* add secure config import and export ([#21](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/21)) ([de90387](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/de90387a63e586e95ee0c5d1929e8672446bf1b0))
* add secure Linux update flow ([#24](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/24)) ([8e4e16c](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/8e4e16cb0bf721a4bad7c6795e606dbcbb392df8))
* **linux:** manage official hardware permissions ([#22](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/22)) ([46fa60a](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/46fa60ac3d68c4a39f5078b9914478eb4cd60374))
* **settings:** encrypt persisted secrets on Linux ([#20](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/20)) ([bbfd8d6](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/bbfd8d6dde7b5cf0ad642e6100d83d0ecf7917ed))
* **settings:** isolate persisted secrets from renderer ([#12](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/12)) ([264dd4e](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/264dd4ea14e5331fcd66e0ecb8c84e392f314370))
* sign and verify Linux updates ([#44](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/44)) ([aef9a19](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/aef9a197512e9467d17c5935484f2205b4607b47))


### Corrections de bugs

* align app with official firmware defaults ([#23](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/23)) ([bec7b0b](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/bec7b0bf0fdeeaed0245198fe6e733a018538a73))
* bound main and renderer log buffers ([#9](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/9)) ([9066b3f](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/9066b3ffed0b67987dec2a687388850eaaa7fc8a))
* bound privileged input payloads ([#31](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/31)) ([8de9956](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/8de99567d627cece5d83b9d1294fa9df8b3bd556))
* **ci:** disable implicit artifact publishing ([#14](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/14)) ([e68dc1c](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/e68dc1c806d69283eb00dc2bfa413b09364b0315))
* downgrade Electron to restore Linux tray ([#34](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/34)) ([8b0d198](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/8b0d1989f20fcc71aff6580b0b03131282f9e716))
* harden audio and serial recovery ([#29](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/29)) ([98d62d2](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/98d62d26b19cf825c65c4e2079f93f1eb9eff691))
* harden desktop lifecycle handling ([#27](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/27)) ([d4457e9](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/d4457e9a55e40c47bb6abbffc554b4933a5acd69))
* harden Linux release artifact publishing ([#30](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/30)) ([1989448](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/1989448778c36621c89b0ac03476b44e14f9f953))
* migrate legacy brightness state config ([#32](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/32)) ([d872e79](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/d872e7957adb966f0bf3669c74f364a1a99eefa4))
* run audio commands asynchronously ([#19](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/19)) ([70c2caa](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/70c2caaa2de4f98b3b49ec8d26add9681a90b0c9))
* secure Home Assistant configuration and polling ([#28](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/28)) ([aef8783](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/aef8783f2087757a41a0bd76c461daf092b3bd68))
* secure renderer protocol and external links ([#11](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/11)) ([b9c3359](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/b9c33594546d3f87e2d8ff98d454f403fba0d262))
* **security:** validate Discord IPC sockets ([#7](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/7)) ([4129885](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/4129885c9e7465466f957586408158808a834ac7))
* **security:** validate Electron IPC senders ([#8](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/8)) ([0c22f81](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/0c22f81836b85e643759276b01fe700f6e51a41a))
* validate and bound serial protocol input ([#10](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/10)) ([651cf0c](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/651cf0c9f9114c89908caa27f54565493ec32a66))


### Améliorations des performances

* **ci:** speed up Linux verification ([#25](https://github.com/lachaux-remi/StreamDeckDeeJ-App/issues/25)) ([10213a4](https://github.com/lachaux-remi/StreamDeckDeeJ-App/commit/10213a4c36a1447d11280ef8088dacdb1c4fe352))
