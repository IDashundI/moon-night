# moon-night

A Claude Code mod that draws an animated pixel-art landscape in a band above the prompt. From 18:00 to 06:00 it is a moonlit night with twinkling stars, shooting stars, a glowing moon, drifting clouds, pine trees, fireflies and a lake with the moon's reflection. From 06:00 to 18:00 it is a sunny day with a sun with rays, fluffy clouds, birds, snowy mountains, flowers, butterflies and a sparkling lake. Pixels at the edges dissolve for soft transitions, and the band fills the width of your terminal. It needs a terminal with truecolor support.

## Commands

- `/moon` hides or shows the band.
- `/moon day` or `/moon night` previews that scene for 10 seconds.

## Install

At the prompt of a terminal session:

```
/plugin install moon-night --marketplace IDashundI/moon-night
```

From a shell:

```
claude plugin install moon-night --marketplace IDashundI/moon-night
```

Answer `y` to add the marketplace, then pick a scope. The user scope loads the mod in every session.
