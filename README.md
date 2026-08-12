# PomoDiary

An hourly time-tracking web app. It stays open in a browser tab all day, keeps a timer, and once
an hour asks you one question: what did you do with the last hour? Your answers are stored so
you can look back over a day or a week, see where the time actually went, and spot the things
that are eating it.

The name is a play on "pomodoro" and "diary": a diary kept on a pomodoro timer. It is not a
classic 25/5 pomodoro timer; the point is the hourly check-in and the record it builds up.

## How it works (planned)

- A multi-user web app deployed on Vercel, with accounts (Clerk) and a Postgres entry log (Neon).
- Every click and keystroke applies instantly: changes queue in a local write-ahead log and a
  background sync persists them in batches every few seconds, so the UI never waits on the
  database and unsaved work survives a closed tab.
- A ring sweeps like a minute hand as the hour passes; you can jot bullets at any point.
- Every entry is a wall-clock hour bucket, :00 to :00. Whatever happens partway through an
  hour is accounted inside its bucket: a gym trip becomes a bullet with its duration, a long
  hold shows up as unaccounted minutes. No ragged 8:01-to-9:00 slivers.
- When the hour chimes you tidy the bullets up, tag the hour, and log it; the next one starts.
- Sleep, Work and Gym away modes back-fill absences as hour blocks, also aligned to the
  clock. A custom option lets you type anything else ("Travelling", say) and remembers your
  recent labels as quick picks.
- "The vine" shows your day as a readable log, and a grid shows where the hours went.

The full design lives in [`design/`](design/README.md); the visual prototype is
`design/Pomodoro.dc.html`.

## Building this project

This project is built by an autonomous implementation harness. To add work and run it, see
[`.harness/README.md`](.harness/README.md).
