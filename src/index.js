const Discord = require("discord.js");
const { prefix, token } = require("./config.json");
const ytdl = require("ytdl-core");

const client = new Discord.Client();
//luodaan jonosta muuttuja
const queue = new Map();


//lisätään komennot, jotka kuuntelevat onko botti valmis sitä käynnistäessä
client.once("ready", () => {
  console.log("Ready!");
});

client.once("reconnecting", () => {
  console.log("Reconnecting!");
});

client.once("disconnect", () => {
  console.log("Disconnect!");
});

//luodaan lista kielletyistä sanoista
let set = new Set(['kirosana', 'kirosana1'])
client.on("message", async message => {

  if(message.author.bot) {
    return
  }
  //jaetaan viesti sanoihin välilyönnin perusteella
  let wordArray = message.content.split(' ')
  console.log(wordArray)
  
  //käydään sanalista läpi viestin pituudella
  for(var i = 0; i < wordArray.length; i++) {
    //jos kirosana ilmenee, poistetaan viesti ja kehotetaan käyttäjää välttämään näitä
    if(set.has(wordArray[i])) {
      message.delete()
      message.channel.send(`Anteeksi vain ${message.author.username}, täällä ei kiroilla!`)
      break
    }
    
  }

  //vältetään loputtomat loopit
  if (message.author.bot) return;
  //tarkistetaan alkaako viesti huutomerkillä 
  if (!message.content.startsWith(prefix)) return;

  const serverQueue = queue.get(message.guild.id);
//luodaan if-lausekkeet eri komennoille
  if (message.content.startsWith(`${prefix}play`)) {
    execute(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}skip`)) {
    skip(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}komennot`)) {
    message.channel.send("Eri komentoja ovat muun muassa: !play (videon osoite), !skip ja !stop")
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(message, serverQueue);
    return;
//ilmoitetaan käyttäjälle että komento ei ole kirjoitettu oikein.
  } else {
    message.channel.send("Anna kunnollinen komento!");
  }
});
//luodaan funktio komennolle, ja tarkistetaan onko käyttäjä palvelimella
// ja onko tällä oikeuksia suorittaa komento

async function execute(message, serverQueue) {
  const args = message.content.split(" ");

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel)
    return message.channel.send(
      "Sinun pitää olla kanavalla voidaksesi kuunnella musiikkia!"
    );
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "Tarvitsen luvat liittyäkseni kanavalle! :("
    );
  }
//luodaan const, jolla tallennetaan videon tiedot ytdl-kirjaston avulla
  const songInfo = await ytdl.getInfo(args[1]);
  const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
   };
//tarkistetaan onko kappale jo päällä, jos ei niin lisätään kappale jonoon tietoineen
  if (!serverQueue) {
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true
    };

    queue.set(message.guild.id, queueContruct);

    queueContruct.songs.push(song);

    try {
      //luodaan yhteys puhekanavalle
      var connection = await voiceChannel.join();
      queueContruct.connection = connection;
      play(message.guild, queueContruct.songs[0]);
    } catch (err) {
      //selvitetään virheen syy jos ei voida liittyä
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
    //kerrotaan käyttäjälle että video on lisätty jonoon, jos jonossa on jo >0 videota
  } else {
    serverQueue.songs.push(song);
    return message.channel.send(`Käyttäjän ${message.author.username} toive ${song.title} on lisätty jonoon!`);
  }
}

function skip(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "Liity kanavalle ohittaaksesi!"
    );
  if (!serverQueue)
  //jos kappaletta ei jonossa annetaan kyseinen viesti-ilmoitus
    return message.channel.send("Minkä kappaleen haluat ohittaa? Mikään kappale ei soi juuri nyt.");
    //lähdetään palvelimelta jos jonon pituus on 0
  serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
  //jos käyttäjä yrittää käyttää !stop komentoa kanavan ulkopuolelta
  if (!message.member.voice.channel)
    return message.channel.send(
      "Et voi antaa komentoja kanavan ulkopuolelta!"
    );
    // jos jono on jo tyhjä
  if (!serverQueue)
    return message.channel.send("Mitä yrität pysäyttää? Mikään kappale ei soi juuri nyt.");
    //tyhjentää listan, ja kirjaa täten ulos kanavalta
  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  //jos kappaletta ei enää ole lähdetään kanavalta, ja tyhjennetään jono
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }
//käytetään play komentoa ja välitetään kappaleen url-osoite, ja kuunnellaan 
//kappaleen loppumista ja mahdollisia virheitä
  const dispatcher = serverQueue.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    //määritellään sopiva äänenvoimakkuus jota käyttäjä voi myös säätää Discordin avulla
  dispatcher.setVolume(serverQueue.volume / 5);
//ilmoitetaan käyttäjille viestillä mitä videota toistetaan
  serverQueue.textChannel.send(`Nyt soi: **${song.title}**`);

  
}




client.login(token);