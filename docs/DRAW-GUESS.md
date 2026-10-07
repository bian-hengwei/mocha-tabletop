# Mocha Sketch rules

Mocha Sketch supports 3–12 players. Before starting, the host chooses one to six drawing cycles per player and a 45, 60, 75, or 90 second drawing timer. A cycle is complete only after every player has drawn once.

At the start of a turn, the drawer privately receives three prompt choices and selects one. The drawer can see the selected answer while drawing. Other players and spectators receive only the shared canvas and ordinary guesses. The first correct guess scores 2 points and the drawer scores 1 point; the answer is revealed at the end of the turn. Highest score wins, with ties shared.

Each submitted stroke uses quantized coordinates and has bounded point and stroke counts so the live canvas remains practical to synchronize. The table supports freehand strokes and clearing the whole current canvas; it does not provide an eraser or live interpolation between submitted strokes.

Cloud rooms use the server clock and Wi-Fi-direct rooms use the LAN host clock. A participant disconnect pauses the current deadline and preserves the canvas. When every participant reconnects, the same turn resumes with its remaining time. Pass-and-play practice uses the local browser as the authoritative clock and advances saved deadlines after restoration.
