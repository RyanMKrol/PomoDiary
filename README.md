# PomoDiary

An hourly time-tracking web app. It stays open in a browser tab all day, keeps a timer, and once
an hour asks you one question: what did you do with the last hour? Your answers are stored so
you can look back over a day or a week, see where the time actually went, and spot the things
that are eating it.

The name is a play on "pomodoro" and "diary": a diary kept on a pomodoro timer. It is not a
classic 25/5 pomodoro timer; the point is the hourly check-in and the record it builds up.

## How it works (planned)

- A multi-user web app deployed on Vercel, with accounts (Clerk) and a Postgres entry log (Neon).
- A one-hour ring fills on screen; you can jot bullets at any point during the hour.
- When the hour chimes you tidy the bullets up, tag the hour, and log it; the next hour starts.
- Sleep and Work away modes back-fill absences as one-hour blocks.
- "The vine" shows your day as a readable log, and a 10-day grid shows where the hours went.

The full design lives in [`design/`](design/README.md); the visual prototype is
`design/Pomodoro.dc.html`.

## Building this project

This project is built by an autonomous implementation harness. To add work and run it, see
[`.harness/README.md`](.harness/README.md).
