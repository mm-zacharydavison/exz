// kadai:name Countdown
// kadai:emoji ⏳
// kadai:description Count down from 5

for (let i = 5; i > 0; i--) {
  console.log(`${i}...`);
  await Bun.sleep(500);
}
console.log("Done!");
