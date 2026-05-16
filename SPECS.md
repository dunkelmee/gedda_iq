Final Refined Game Prompt
Project Name: Gedda IQ Arena
Game Overview
Create a fast-paced realtime multiplayer browser game where players compete in live 1v1 arithmetic battles.
The experience should feel competitive, responsive, lightweight, and addictive — similar to an online arena duel game.
Core Gameplay
Online Arena / Lobby
Players join a shared online arena lobby.
Each player is represented by:
nickname
avatar/icon
Since players appear in the arena, they are automatically considered online.
Challenge System
Any player can challenge another player to a duel.
The challenged player can:
Accept
Reject
Match Start
When a challenge is accepted:
both players enter a private realtime match room
the match begins simultaneously for both players
both players receive the exact same arithmetic questions in the same order
Match Rules
Duration
Each match lasts exactly 60 seconds
Arithmetic Questions
Questions are limited to:
addition (+)
subtraction (-)
only 2-digit numbers
Examples:
34 + 27
91 - 46
Multiple Choice System
Each arithmetic question displays 4 possible answers.
Requirements:
only 1 answer is correct
the remaining 3 are believable incorrect answers
answer positions are randomized every round
the player must choose one answer before moving to the next question
immediately after selecting an answer:
the system evaluates it
the score updates instantly
the next question appears immediately
Example:
Plain text
45 + 18 = ?

A) 63   ← correct
B) 61
C) 67
D) 58
Wrong Answer Logic
Incorrect answers should:
stay close to the correct result
imitate common mental math mistakes
avoid obviously fake numbers
Examples:
±1 or ±2 mistakes
digit swaps
addition/subtraction slips
Scoring System
Correct answer → +1 point
Wrong answer → -2 points
The faster a player answers, the more questions they can complete within 60 seconds.
Winning Conditions
After 60 seconds:
the player with the highest score wins
a results screen displays:
total score
correct answers
wrong answers
accuracy percentage
answers per minute
winner announcement
Technical Stack
Frontend
Use:
Next.js⁠�
React⁠�
Tailwind CSS⁠�
UI goals:
smooth
modern
responsive
mobile-friendly
low-latency feel
Backend
Use:
Node.js⁠�
Express⁠�
Socket.IO⁠�
Backend handles:
realtime communication
challenge requests
room creation
synchronized timers
arithmetic generation
answer validation
scoring
anti-cheat protection
Database
Use:
PostgreSQL⁠� with:
Prisma⁠�
Store:
player profiles
avatars
rankings
match history
statistics
Local Development Setup
Frontend
Bash
npm run dev
Runs on:
Plain text
http://localhost:3000
Backend
Bash
npm run dev
Runs on:
Plain text
http://localhost:4000
Deployment
Frontend
Vercel⁠�
Backend
Railway⁠� or
Render⁠�
Important Server Logic
The backend must:
generate all arithmetic questions
generate all answer choices
verify answers
calculate scores
synchronize timers between players
Never trust frontend calculations or scores.
Recommended MVP Features
Build first:
nickname login
online arena lobby
challenge system
realtime 1v1 rooms
synchronized timer
arithmetic engine
multiple-choice answers
score tracking
result screen
Future improvements:
ranked matchmaking
Elo rating system
global leaderboard
tournaments
cosmetics
sound effects
spectating
rematch button