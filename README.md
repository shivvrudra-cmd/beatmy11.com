# BeatMy11.com

Build your all-time cricket XI and see if you can beat the house team in a 5-match Test series.

## 🏏 About

BeatMy11 is a strategic fantasy cricket game where you build an all-time Test XI through 6 spins, each giving you a random nation + era combination. Choose 2 players per spin, following role constraints, then see how your XI performs against the Beat My 11 house team.

## ✨ Features

- **6-Spin Team Building**: Random nation + era combinations with strategic player selection
- **Historical Depth**: Players from Legends era through 2020s across 10 Test nations
- **Role Constraints**: Max 1 opener, 1 wicketkeeper, 1 all-rounder per spin
- **Reroll System**: 1 team reroll + 1 era reroll for strategic flexibility
- **Era-Normalized Ratings**: Fair comparison across cricket eras using statistical indices
- **5-Match Series Simulation**: See your XI compete against Beat My 11

## 🚀 Tech Stack

- **Astro** - Static site generator
- **Tailwind CSS v4** - Styling
- **TypeScript** - Type safety
- **Vercel** - Deployment (planned)

## 📁 Project Structure

```
beatmy11.com/
├── src/
│   ├── components/       # Reusable UI components
│   ├── data/            # Player data by era (JSON)
│   ├── layouts/         # Page layouts
│   ├── lib/             # Game engine & rating system
│   ├── pages/           # Routes
│   ├── styles/          # Global styles
│   └── types/           # TypeScript definitions
├── docs/
│   └── beatmy11.md      # Complete specification
├── public/              # Static assets
└── package.json
```

## 🎮 Game Mechanics

### Team Composition (12 players, 11 active)
- 2 Openers
- 3 Middle-order batsmen
- 1 Wicketkeeper
- 2 All-rounders
- 4 Bowlers
- User designates 12th man

### Eras
- 🏆 Legends (42 all-time greats)
- 📼 1970s
- 📻 1980s
- 💾 1990s
- 📱 2000s
- 📲 2010s
- 🚀 2020s

### Nations
Australia, England, India, Pakistan, West Indies, New Zealand, South Africa, Sri Lanka, Bangladesh, Zimbabwe

### Historical Exclusions
- South Africa: No 1970s/1980s (apartheid isolation)
- Sri Lanka: No 1970s (Test status 1981)
- Bangladesh: Pre-2000 (Test status 2000)
- Zimbabwe: No 1970s/1980s (Test status 1992)

## 🧮 Rating System

- **Era-Normalized Indices**: Fair comparison across eras
- **Bradman Curve**: Diminishing returns prevent single-player dominance
- **Team Balance Modifiers**: Rewards variety and depth
- **Volume Multiplier**: Minimum 20 Tests to qualify

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📝 Documentation

See `beatmy11.md` for complete project specification including:
- Full player database across all eras
- Rating & scoring algorithms
- Game mechanics & constraints
- MVP scope & future features

## 🎯 Current Status

**Foundation Complete:**
- ✅ Project structure & configuration
- ✅ Player database (Legends + 1980s sample)
- ✅ Rating system implementation
- ✅ Game engine logic
- ✅ Basic UI components

**In Progress:**
- 🔄 Complete player data for all decades
- 🔄 Full game UI implementation
- 🔄 Results & share card generation

**Planned:**
- ⏳ Daily seed system
- ⏳ Streak tracking
- ⏳ Share cards
- ⏳ Mobile optimization

## 📄 License

ISC

## 👨‍💻 Development Notes

This project follows established development standards:
- Astro best practices
- Tailwind CSS v4
- Vercel Web Interface Guidelines
- SEO optimization
- Accessibility compliance
- Core Web Vitals optimization

---

Built with cricket passion 🏏
