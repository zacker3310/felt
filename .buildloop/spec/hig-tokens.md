# HIG token sheet: sources and values

The token `:root` at the top of `index.html`'s `<style>` ("the HIG token sheet") is the single source of
colour, type, spacing, radii, separators and materials for every sheet (setup, Settings, How to Play,
Stats, the modes, the career, drills). This file records where each value comes from. Build
2026-10-29n.

apple.com, developer.apple.com and Figma were not reachable from the build machine; GitHub was. So the
values come from open-source projects that mirror UIKit's own tables, cross-checked where two exist.
Where no source was reachable the value is marked **memory** (from knowledge of iOS, not a file).

## Sources (fetched 2026-10-30 from raw.githubusercontent.com, default branches)

| Key | Source | What it gives |
|---|---|---|
| F-colors | [flutter/flutter `packages/flutter/lib/src/cupertino/colors.dart`](https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/cupertino/colors.dart) | Every UIKit dynamic system colour, light and dark (each documented as equal to its `UIColor`) |
| F-seg | [flutter/flutter `cupertino/sliding_segmented_control.dart`](https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/cupertino/sliding_segmented_control.dart) | UISegmentedControl: track, thumb, radii, shadows, dividers, words ("Colors extracted from developer.apple.com/design/resources") |
| F-list | [flutter/flutter `cupertino/list_section.dart`](https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/cupertino/list_section.dart), [`list_tile.dart`](https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/cupertino/list_tile.dart) | Inset grouped list: margins, radius, header/footer colour and size, divider thickness and insets, row heights |
| F-menu | [flutter/flutter `cupertino/context_menu.dart`](https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/cupertino/context_menu.dart), [`context_menu_action.dart`](https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/cupertino/context_menu_action.dart) | Menu width, item height, pressed colour |
| F-text | [flutter/flutter `cupertino/text_theme.dart`](https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/cupertino/text_theme.dart) | Body 17 / -0.41, Large Title 34 bold / +0.38, nav title 17 semibold |
| RNT | [hectahertz/react-native-typography `src/collections/human.js`](https://github.com/hectahertz/react-native-typography/blob/master/src/collections/human.js), [`src/helpers/sanFranciscoSpacing.js`](https://github.com/hectahertz/react-native-typography/blob/master/src/helpers/sanFranciscoSpacing.js) | The whole Dynamic Type ramp (size and leading) and SF's tracking per point size |
| ION | [ionic-team/ionic-framework `core/src/components/*/*.ios.vars.scss`](https://github.com/ionic-team/ionic-framework/tree/main/core/src/components) (item, list, segment, segment-button, popover, toolbar) | Cross-check: iOS-mode item, inset list, segment, popover and toolbar metrics |

## Colour (dark appearance)

| Token | Value | UIKit name | Source |
|---|---|---|---|
| `--sys-grouped` | `#000000` | systemGroupedBackground | F-colors |
| `--sys-grouped-2` | `#1c1c1e` | secondarySystemGroupedBackground | F-colors (also secondarySystemBackground, systemGray6) |
| `--sys-grouped-3` | `#2c2c2e` | tertiarySystemGroupedBackground | F-colors |
| `--sys-bg`, `-2`, `-3` | `#000`, `#1c1c1e`, `#2c2c2e` | systemBackground, secondary, tertiary | F-colors |
| `--sys-label` | `#ffffff` | label | F-colors |
| `--sys-label-2` | `rgba(235,235,245,.6)` | secondaryLabel (alpha 153) | F-colors |
| `--sys-label-3` | `rgba(235,235,245,.3)` | tertiaryLabel (alpha 76) | F-colors |
| `--sys-label-4` | `rgba(235,235,245,.16)` | quaternaryLabel (alpha 40) | F-colors |
| `--sys-fill` .. `-4` | `rgba(120,120,128,.36)`, `(120,120,128,.32)`, `(118,118,128,.24)`, `(118,118,128,.18)` | systemFill, secondary, tertiary, quaternary (alphas 91, 81, 61, 45) | F-colors |
| `--sys-sep` | `rgba(84,84,88,.6)` | separator (alpha 153) | F-colors |
| `--sys-sep-opaque` | `#38383a` | opaqueSeparator | F-colors |
| `--sys-gray` .. `-6` | `#8e8e93 #636366 #48484a #3a3a3c #2c2c2e #1c1c1e` | systemGray .. systemGray6 | F-colors |
| `--sys-head` | `#8e8e92` | inset grouped header/footer words | F-list (`_kHeaderFooterColor` dark) |
| `--sys-green` | `#30d158` | systemGreen (a switch's on track) | F-colors |
| `--sys-red` | `#ff453a` | systemRed | F-colors |
| `--sys-press` | `#3a3a3c` | a held row (systemGray4) | F-colors value; use as the highlight is **memory** (F-menu's pressed `#3f3f40` is close) |

Contrast, measured by the suites (`lowContrast`): secondaryLabel is 5.9:1 on `#1c1c1e` and 7.2:1 on
black; the header grey `#8e8e92` 6.4:1 on black. tertiaryLabel (about 2.3:1) is used only for
chevrons, never for words.

## Type (Dynamic Type, the Large default size)

| Token | Size / leading | Weight | Tracking | Source |
|---|---|---|---|---|
| `--t-large` | 34 / 41 | 700 | +0.37 | RNT (size, leading), RNT/F-text (tracking +0.38; RNT table 0.382 at 34) |
| `--t-title1` | 28 / 34 | 700 | +0.36 | RNT |
| `--t-title2` | 22 / 28 | 700 | +0.35 | RNT |
| `--t-title3` | 20 / 25 | 600 | +0.38 | RNT |
| `--t-headline` | 17 / 22 | 600 | -0.41 | RNT, F-text |
| `--t-body` | 17 / 22 | 400 | -0.41 | RNT, F-text (-0.41) |
| `--t-callout` | 16 / 21 | 400 | -0.32 | RNT |
| `--t-subhead` | 15 / 20 | 400 | -0.24 | RNT (F-text: -0.23 at 15) |
| `--t-footnote` | 13 / 18 | 400 | -0.08 | RNT |
| `--t-caption1` | 12 / 16 | 400 | 0 | RNT |
| `--t-caption2` | 11 / 13 | 400 | +0.06 | RNT |

The ramp's sizes (34 28 22 20 17 16 15 13 12 11) are the only font sizes on the sheets; `hig-check`
scans every word of every sheet for it. Larger Text (Settings > Accessibility) zooms the sheets
(`zoom: 1.15` / `1.3`, as before), which scales every token together.
Fonts: `-apple-system` / SF Pro on the iPhone; the suites measure with Inter (CLAUDE.md).

## The inset grouped list

| Token | Value | Source |
|---|---|---|
| `--row-h` | 44 | F-list (`_kMinHeight` = 28 + 2 x 8), ION (`$item-ios-min-height: 44px`) |
| `--row-px` | 16 | ION (`$item-ios-padding-start/end: 16px`); F-list uses 20 on the outer list margin and 14 within |
| `--row-py` | 11 | ION (10) + **memory** (UIKit's 11 for a 22 pt line in 44) |
| `--row-icon` | 29, radius `--r-icon` 7 | **memory** (Settings' icon tiles) |
| `--sep-l`, `--sep-l-icon` | 16, 60 | separators inset to the words: F-list (14 + 28 leading = 42 in Flutter's own insets), the 60 for a 29 pt icon + 15 gap is **memory** |
| `--hl` | 1 px scaled to 1 / devicePixelRatio (.5 at 2x, .3334 at 3x) | F-list (`dividerHeight = 1.0 / devicePixelRatio`), ION (`$hairlines-width`) |
| `--group-gap`, `--head-mt`, `--head-mb`, `--foot-mt` | 20, 22, 7, 7 | F-list (`_kMarginTop` 22, header margins 16/6, rows margin 20); 7 is **memory** |
| `--r-group` | 26 | **memory**: iOS 26's rounder inset groups. The sourced pre-iOS 26 value is 10 (F-list `_kDefaultInsetGroupedBorderRadius`, ION `$list-inset-ios-border-radius`) |
| header / footer words | Footnote 13 in `--sys-head` | F-list (header `fontSize: 13.0`, header/footer colour) |

## The segmented control (UISegmentedControl)

| Token | Value | Source |
|---|---|---|
| `--seg-h` | 32 (track) inside a 44 pt row target | ION (min-height 28 + 2 x 2 margin = 32); F-seg's minimum 28 is the thumb; 32 is UIKit's default height (**memory**, matches ION) |
| `--seg-in` | 2 (thumb inset) | F-seg (`_kHorizontalItemPadding` vertical 2), ION (`$segment-button-ios-margin: 2px`) |
| `--seg-track` | tertiarySystemFill | F-seg (`backgroundColor = CupertinoColors.tertiarySystemFill`) |
| `--seg-thumb` | `#636366` | F-seg (`_kThumbColor` dark) |
| `--seg-shadow` | `0 3px 8px rgba(0,0,0,.12), 0 3px 1px rgba(0,0,0,.04)` | F-seg (`thumbShadow`) |
| `--seg-div` | `rgba(142,142,147,.3)`, 14 tall | F-seg (`_kSeparatorColor 0x4D8E8E93`, inset 5 of 28 -> 14 of 32 here, rounded) |
| words | 13, 500; 600 on the chosen one | F-seg (`_kFontSize 13`, `w500`, highlighted `w600`), ION (13 px) |
| `--r-seg`, `--r-thumb` | 16 (capsule), 14 | **memory**: iOS 26's capsule control. Sourced pre-26: 9 and 7 (F-seg), 8 and 7 (ION) |

## The pop-up button and its menu (UIMenu)

| Token | Value | Source |
|---|---|---|
| value + `chevron.up.chevron.down` | Body 17 in secondaryLabel, trailing | **memory** (SwiftUI's menu `Picker` in a `Form`); the glyph is drawn as SVG |
| menu width | 250 minimum | F-menu (`_kMenuWidth = 250`); ION popover 200 |
| item | 44 tall, Body 17, checkmark leading | F-menu (`_kButtonHeight = 43` + its hairline), **memory** for 17 pt (F-menu's context-menu action is 16) and the leading checkmark |
| `--mat-menu`, `--mat-blur` | `rgba(37,37,39,.94)`, `saturate(180%) blur(30px)` | ION (`$popover-ios-translucent-filter: saturate(180%) blur(20px)`, alpha .8); F-menu dark `#212122`. Alpha raised to .94 so words behind never read through (measured 4.5:1 for every item) |
| `--r-menu` | 26 | **memory** (iOS 26 menus); sourced pre-26: 10 (ION popover), 12 (F-menu preview) |
| `--menu-shadow` | `0 12px 40px rgba(0,0,0,.5)` + a .5 px light rim | **memory**; F-menu's end shadow is `0x40000000` blur 10 |

## Other

| Token / value | Source |
|---|---|
| UISwitch 51 x 31, knob 27, on `--sys-green`, off `--sys-fill` | **memory** (UIKit's switch), colours F-colors |
| Back button: a 44 pt circle, chevron.left | **memory** (iOS 26 navigation bar) |
| Primary action: a 50 pt capsule, Headline 17 semibold | **memory** (iOS 26 prominent button), the app's existing white capsule kept |
| `--mat-bar` `rgba(0,0,0,.76)` under the pinned bars | ION (toolbar translucent), **memory** for the alpha |
| `--tint` | the cloth's accent (`#3ddc84` green, `#ff8a7a` red, `#7cb6ff` blue): the app's tint for list checkmarks and row glyphs |

## Liquid Glass (iOS 26)

No source was reachable for Liquid Glass's numbers (Apple's design resources and documentation are
off this network; GitHub searches found only prose guides). What is used is from memory and kept
conservative: rounder groups and menus (26), capsule segmented controls, a glass-grey circular back
button, the bar material under pinned actions. Blur is used only for a sheet's own materials (the
menu, the pinned bars over a scrolling page), never over the table (boot-check).
