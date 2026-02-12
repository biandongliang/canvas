const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
// 允许跨域（适配GitHub Pages访问）
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 存储玩家信息
let players = {};
let playerCount = 0;

// 提供静态文件
app.use(express.static(path.join(__dirname)));

// 根路由返回游戏页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Socket连接处理
io.on('connection', (socket) => {
  console.log('玩家连接:', socket.id);
  
  // 分配玩家ID（1或2）
  if (playerCount < 2) {
    const playerId = playerCount + 1;
    players[socket.id] = {
      id: playerId,
      x: playerId === 1 ? 50 : 700, // 玩家1在左，玩家2在右
      y: 300,
      color: playerId === 1 ? '#ff4444' : '#4444ff'
    };
    playerCount++;
    
    // 告知玩家自己的ID和初始位置
    socket.emit('player-assign', players[socket.id]);
    // 广播所有玩家信息
    io.emit('players-update', players);
    
    // 监听玩家移动
    socket.on('player-move', (data) => {
      if (players[socket.id]) {
        // 边界检测（防止移出画布）
        data.x = Math.max(0, Math.min(750, data.x));
        data.y = Math.max(0, Math.min(550, data.y));
        
        players[socket.id].x = data.x;
        players[socket.id].y = data.y;
        // 广播最新位置
        io.emit('players-update', players);
        
        // 碰撞检测（判断胜负）
        checkCollision(io, players);
      }
    });
  } else {
    // 房间已满
    socket.emit('room-full');
  }
  
  // 断开连接处理
  socket.on('disconnect', () => {
    console.log('玩家断开:', socket.id);
    if (players[socket.id]) {
      delete players[socket.id];
      playerCount--;
      io.emit('players-update', players);
    }
  });
});

// 碰撞检测函数
function checkCollision(io, players) {
  const playerList = Object.values(players);
  if (playerList.length === 2) {
    const p1 = playerList[0];
    const p2 = playerList[1];
    
    // 简单的矩形碰撞检测（方块大小50x50）
    const collision = (
      p1.x < p2.x + 50 &&
      p1.x + 50 > p2.x &&
      p1.y < p2.y + 50 &&
      p1.y + 50 > p2.y
    );
    
    if (collision) {
      // 判定获胜者（谁先移动到对方区域）
      const winner = p1.id;
      io.emit('game-over', { winner: winner });
      
      // 重置游戏
      players = {};
      playerCount = 0;
    }
  }
}

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});