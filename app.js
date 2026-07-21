const express = require('express');
const app = express();
app.use(express.json());

// ---------------------------------------------------------------
// IN-MEMORY "DATABASE"
// ---------------------------------------------------------------
let db = {
    users: [],
    posts: [],
    comments: [],
    nextUserId: 1,
    nextPostId: 1,
    nextCommentId: 1
};

function seed() {
    const u1 = { id: db.nextUserId++, username: 'alice', bio: 'Coffee & code', followers: [], following: [] };
    const u2 = { id: db.nextUserId++, username: 'bob', bio: 'Photographer', followers: [], following: [] };
    db.users.push(u1, u2);

    const p1 = { id: db.nextPostId++, userId: u1.id, content: 'Hello world, this is my first post!', likes: [], createdAt: Date.now() };
    db.posts.push(p1);

    db.comments.push({ id: db.nextCommentId++, postId: p1.id, userId: u2.id, content: 'Welcome!', createdAt: Date.now() });
}
seed();

function findUser(id) { return db.users.find(u => u.id === Number(id)); }
function findPost(id) { return db.posts.find(p => p.id === Number(id)); }

function publicUser(u) {
    return {
        id: u.id,
        username: u.username,
        bio: u.bio,
        followersCount: u.followers.length,
        followingCount: u.following.length
    };
}

function publicPost(p) {
    const author = findUser(p.userId);
    const comments = db.comments
        .filter(c => c.postId === p.id)
        .map(c => ({ ...c, username: findUser(c.userId) ? findUser(c.userId).username : 'unknown' }));
    return {
        id: p.id,
        content: p.content,
        createdAt: p.createdAt,
        likeCount: p.likes.length,
        userId: p.userId,
        username: author ? author.username : 'unknown',
        comments
    };
}

// ---------------------------------------------------------------
// API ROUTES
// ---------------------------------------------------------------

// --- Users ---
app.get('/api/users', (req, res) => {
    res.json(db.users.map(publicUser));
});

app.post('/api/users', (req, res) => {
    const { username, bio } = req.body;
    if (!username || !username.trim()) {
        return res.status(400).json({ error: 'username is required' });
    }
    const existing = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (existing) return res.json(publicUser(existing));

    const user = { id: db.nextUserId++, username: username.trim(), bio: bio || '', followers: [], following: [] };
    db.users.push(user);
    res.status(201).json(publicUser(user));
});

app.get('/api/users/:id', (req, res) => {
    const user = findUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(publicUser(user));
});

app.get('/api/users/:id/posts', (req, res) => {
    const user = findUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const posts = db.posts.filter(p => p.userId === user.id).map(publicPost);
    res.json(posts);
});

// Follow / unfollow (toggle)
app.post('/api/users/:id/follow', (req, res) => {
    const target = findUser(req.params.id);
    const { followerId } = req.body;
    const follower = findUser(followerId);

    if (!target || !follower) return res.status(404).json({ error: 'User not found' });
    if (target.id === follower.id) return res.status(400).json({ error: "You can't follow yourself" });

    const idx = target.followers.indexOf(follower.id);
    let following;
    if (idx === -1) {
        target.followers.push(follower.id);
        follower.following.push(target.id);
        following = true;
    } else {
        target.followers.splice(idx, 1);
        follower.following = follower.following.filter(id => id !== target.id);
        following = false;
    }
    res.json({ following, followersCount: target.followers.length });
});

// --- Posts ---
app.get('/api/posts', (req, res) => {
    const posts = [...db.posts].sort((a, b) => b.createdAt - a.createdAt).map(publicPost);
    res.json(posts);
});

app.post('/api/posts', (req, res) => {
    const { userId, content } = req.body;
    const user = findUser(userId);
    if (!user) return res.status(400).json({ error: 'Invalid user' });
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });

    const post = { id: db.nextPostId++, userId: user.id, content: content.trim(), likes: [], createdAt: Date.now() };
    db.posts.push(post);
    res.status(201).json(publicPost(post));
});

// Like / unlike (toggle)
app.post('/api/posts/:id/like', (req, res) => {
    const post = findPost(req.params.id);
    const { userId } = req.body;
    const user = findUser(userId);
    if (!post || !user) return res.status(404).json({ error: 'Not found' });

    const idx = post.likes.indexOf(user.id);
    let liked;
    if (idx === -1) {
        post.likes.push(user.id);
        liked = true;
    } else {
        post.likes.splice(idx, 1);
        liked = false;
    }
    res.json({ liked, likeCount: post.likes.length });
});

// --- Comments ---
app.post('/api/posts/:id/comments', (req, res) => {
    const post = findPost(req.params.id);
    const { userId, content } = req.body;
    const user = findUser(userId);
    if (!post || !user) return res.status(404).json({ error: 'Not found' });
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });

    const comment = { id: db.nextCommentId++, postId: post.id, userId: user.id, content: content.trim(), createdAt: Date.now() };
    db.comments.push(comment);
    res.status(201).json(comment);
});

// ---------------------------------------------------------------
// FRONTEND (served as one HTML page)
// ---------------------------------------------------------------
app.get('/', (req, res) => {
    res.send(HTML_PAGE);
});

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Mini Social</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; background: #f0f2f5; margin: 0; color: #1c1e21; }
  header { background: #4a56e2; color: white; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; }
  header h1 { margin: 0; font-size: 20px; }
  .container { max-width: 640px; margin: 20px auto; padding: 0 12px; }
  .card { background: white; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
  input, textarea, select, button { font-family: inherit; font-size: 14px; }
  input[type=text], textarea { width: 100%; padding: 8px; border: 1px solid #ccd0d5; border-radius: 6px; margin-top: 6px; }
  textarea { resize: vertical; min-height: 60px; }
  button { cursor: pointer; border: none; border-radius: 6px; padding: 8px 14px; background: #4a56e2; color: white; margin-top: 8px; }
  button:hover { background: #3a44c1; }
  button.secondary { background: #e4e6eb; color: #1c1e21; }
  button.secondary:hover { background: #d8dade; }
  button.small { padding: 4px 10px; font-size: 12px; margin: 0 4px 0 0; }
  .row { display: flex; gap: 8px; align-items: center; }
  .post { border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }
  .post:last-child { border-bottom: none; }
  .author { font-weight: bold; cursor: pointer; color: #4a56e2; }
  .meta { color: #65676b; font-size: 12px; margin-bottom: 6px; }
  .content { margin: 6px 0; white-space: pre-wrap; }
  .actions { margin-top: 6px; }
  .liked { background: #e0245e !important; }
  .comment { font-size: 13px; padding: 4px 0 4px 10px; border-left: 2px solid #eee; margin-top: 6px; }
  .userlist span { display: inline-block; background: #e4e6eb; padding: 4px 10px; border-radius: 14px; margin: 3px; cursor: pointer; font-size: 13px; }
  .userlist span.active { background: #4a56e2; color: white; }
  #profileBox { display: none; }
  .followbtn.following { background: #e4e6eb; color: #1c1e21; }
  small.hint { color: #65676b; }
</style>
</head>
<body>

<header>
  <h1>🌐 Mini Social</h1>
  <div id="whoami" class="row"></div>
</header>

<div class="container">

  <div class="card">
    <strong>Switch / Create User</strong>
    <div class="row" style="margin-top:8px;">
      <input type="text" id="newUsername" placeholder="Enter a username">
      <button onclick="createOrSwitchUser()">Go</button>
    </div>
    <div class="userlist" id="userList"></div>
  </div>

  <div class="card" id="composeBox">
    <strong>Create a Post</strong>
    <textarea id="postContent" placeholder="What's on your mind?"></textarea>
    <button onclick="createPost()">Post</button>
  </div>

  <div class="card" id="profileBox">
    <div id="profileContent"></div>
  </div>

  <div class="card">
    <strong>Feed</strong>
    <div id="feed"></div>
  </div>

</div>

<script>
  var currentUser = null;

  function api(url, method, body) {
    return fetch(url, {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { return r.json(); });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
  }

  function renderWhoAmI() {
    var el = document.getElementById('whoami');
    el.innerHTML = currentUser ? ('Logged in as <strong>&nbsp;' + escapeHtml(currentUser.username) + '</strong>') : 'Not logged in';
  }

  function createOrSwitchUser() {
    var input = document.getElementById('newUsername');
    var name = input.value.trim();
    if (!name) return;
    api('/api/users', 'POST', { username: name }).then(function (user) {
      currentUser = user;
      input.value = '';
      renderWhoAmI();
      loadUsers();
      loadFeed();
    });
  }

  function loadUsers() {
    api('/api/users').then(function (users) {
      var el = document.getElementById('userList');
      el.innerHTML = '';
      users.forEach(function (u) {
        var span = document.createElement('span');
        span.innerText = u.username;
        if (currentUser && currentUser.id === u.id) span.className = 'active';
        span.onclick = function () {
          currentUser = u;
          renderWhoAmI();
          loadUsers();
          loadFeed();
        };
        el.appendChild(span);
      });
    });
  }

  function createPost() {
    if (!currentUser) { alert('Please select or create a user first.'); return; }
    var content = document.getElementById('postContent').value.trim();
    if (!content) return;
    api('/api/posts', 'POST', { userId: currentUser.id, content: content }).then(function () {
      document.getElementById('postContent').value = '';
      loadFeed();
    });
  }

  function toggleLike(postId) {
    if (!currentUser) { alert('Please select or create a user first.'); return; }
    api('/api/posts/' + postId + '/like', 'POST', { userId: currentUser.id }).then(function () {
      loadFeed();
    });
  }

  function addComment(postId) {
    if (!currentUser) { alert('Please select or create a user first.'); return; }
    var input = document.getElementById('commentInput_' + postId);
    var content = input.value.trim();
    if (!content) return;
    api('/api/posts/' + postId + '/comments', 'POST', { userId: currentUser.id, content: content }).then(function () {
      input.value = '';
      loadFeed();
    });
  }

  function showProfile(userId) {
    Promise.all([
      api('/api/users/' + userId),
      api('/api/users/' + userId + '/posts')
    ]).then(function (results) {
      var user = results[0];
      var posts = results[1];
      var isMe = currentUser && currentUser.id === user.id;
      var isFollowing = false;

      var box = document.getElementById('profileBox');
      var html = '';
      html += '<div class="row" style="justify-content:space-between;">';
      html += '<div><h2 style="margin:0;">' + escapeHtml(user.username) + '</h2>';
      html += '<small class="hint">' + escapeHtml(user.bio || '') + '</small></div>';
      if (!isMe && currentUser) {
        html += '<button class="followbtn" id="followBtn">Follow</button>';
      }
      html += '</div>';
      html += '<p>' + user.followersCount + ' followers &nbsp;·&nbsp; ' + user.followingCount + ' following</p>';
      html += '<hr>';
      html += '<strong>Posts</strong>';
      if (posts.length === 0) html += '<p><small class="hint">No posts yet.</small></p>';
      posts.forEach(function (p) {
        html += '<div class="post"><div class="content">' + escapeHtml(p.content) + '</div>';
        html += '<div class="meta">' + p.likeCount + ' likes · ' + p.comments.length + ' comments</div></div>';
      });
      html += '<button class="secondary" onclick="closeProfile()">Close</button>';

      document.getElementById('profileContent').innerHTML = html;
      box.style.display = 'block';
      box.scrollIntoView({ behavior: 'smooth' });

      if (!isMe && currentUser) {
        var btn = document.getElementById('followBtn');
        btn.onclick = function () {
          api('/api/users/' + user.id + '/follow', 'POST', { followerId: currentUser.id }).then(function (r) {
            btn.innerText = r.following ? 'Following' : 'Follow';
            btn.className = 'followbtn' + (r.following ? ' following' : '');
            showProfile(user.id);
          });
        };
      }
    });
  }

  function closeProfile() {
    document.getElementById('profileBox').style.display = 'none';
  }

  function loadFeed() {
    api('/api/posts').then(function (posts) {
      var el = document.getElementById('feed');
      el.innerHTML = '';
      if (posts.length === 0) {
        el.innerHTML = '<p><small class="hint">No posts yet. Be the first!</small></p>';
        return;
      }
      posts.forEach(function (p) {
        var div = document.createElement('div');
        div.className = 'post';

        var likedByMe = false; // like state per-user isn't tracked client-side beyond toggle; UI still works via count
        var commentsHtml = '';
        p.comments.forEach(function (c) {
          commentsHtml += '<div class="comment"><strong>' + escapeHtml(c.username) + ':</strong> ' + escapeHtml(c.content) + '</div>';
        });

        div.innerHTML =
          '<span class="author" onclick="showProfile(' + p.userId + ')">' + escapeHtml(p.username) + '</span>' +
          '<div class="meta">' + new Date(p.createdAt).toLocaleString() + '</div>' +
          '<div class="content">' + escapeHtml(p.content) + '</div>' +
          '<div class="actions">' +
            '<button class="small" onclick="toggleLike(' + p.id + ')">❤️ ' + p.likeCount + '</button>' +
          '</div>' +
          commentsHtml +
          '<div class="row" style="margin-top:6px;">' +
            '<input type="text" id="commentInput_' + p.id + '" placeholder="Write a comment...">' +
            '<button class="small" onclick="addComment(' + p.id + ')">Send</button>' +
          '</div>';

        el.appendChild(div);
      });
    });
  }

  // init
  renderWhoAmI();
  loadUsers();
  loadFeed();
</script>
</body>
</html>`;

// ---------------------------------------------------------------
app.listen(3000, () => {
    console.log('✅ Mini Social running at http://localhost:3000');
});