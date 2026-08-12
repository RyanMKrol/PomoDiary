# PomoDiary

An hourly time-tracking web app. It stays open in a browser tab all day, keeps a timer, and once
an hour asks you one question: what did you do with the last hour? Your answers are stored so
you can look back over a day or a week, see where the time actually went, and spot the things
that are eating it.

The name is a play on "pomodoro" and "diary": a diary kept on a pomodoro timer. It is not a
classic 25/5 pomodoro timer; the point is the hourly check-in and the record it builds up.

## How it works (planned)

- A multi-user web app deployed on Vercel, with accounts (Clerk) and a Postgres entry log (Neon).
- A ring fills on screen as the hour passes; you can jot bullets at any point during the hour.
- Blocks line up with the clock on the wall: whenever a block starts, it runs until the next
  :00, so a block begun at 10:27 chimes at 11:00 and is logged as 10:27 to 11:00.
- When the block chimes you tidy the bullets up, tag the hour, and log it; the next one starts.
- Sleep and Work away modes back-fill absences as hour blocks, also aligned to the clock.
- "The vine" shows your day as a readable log, and a grid shows where the hours went.

The full design lives in [`design/`](design/README.md); the visual prototype is
`design/Pomodoro.dc.html`.

## Building this project

This project is built by an autonomous implementation harness. To add work and run it, see
[`.harness/README.md`](.harness/README.md).
