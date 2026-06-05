import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBc_VU59b9zlWfYU9tFJck3tlaVrjhlw0U",
  authDomain: "kafedra-booking.firebaseapp.com",
  projectId: "kafedra-booking",
  storageBucket: "kafedra-booking.firebasestorage.app",
  messagingSenderId: "1040920370175",
  appId: "1:1040920370175:web:8cea1a134563d1666465ca"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ROOMS = [
  {id:'602',name:'602',type:'Майстерня ОВМ'},
  {id:'603',name:'603',type:'Майстерня ОВМ'},
  {id:'604',name:'604',type:'Майстерня ОВМ'},
  {id:'605',name:'605',type:'Майстерня ОВМ'},
  {id:'606',name:'606',type:'Лекційна'},
  {id:'607',name:'607',type:'Галерея «Це»'},
  {id:'608',name:'608',type:'Бібліотека'},
  {id:'609',name:'609',type:'Комп\'ютерний клас'},
  {id:'610',name:'610',type:'Мультимедійна майстерня'},
];
const CORRIDORS = [
  {id:'cor-c',name:'лаундж 1', type:'коридор', isCorridor:true},
  {id:'cor-b',name:'центр', type:'коридор', isCorridor:true},
  {id:'cor-a',name:'лаундж 2', type:'коридор', isCorridor:true},
];
const ALL_ROOMS = [...ROOMS, ...CORRIDORS];
const STAGE_MAX_SLOTS = 4;

const STAGE_DATETIME = {
  stage1: { min: "2026-06-05T00:00", max: "2026-06-09T23:59", label: "1-2 курси" },
  stage2: { min: "2026-06-10T00:00", max: "2026-06-12T23:59", label: "3-5 курси" }
};

let bookings = [];
let selectedRoomId = null;
let editId = null;
let selectedStagesForm = ['stage1'];

onSnapshot(collection(db, 'bookings'), snap => {
  bookings = snap.docs.map(d => ({id: d.id, ...d.data()}));
  render();
  updateMapColors();
  if(selectedRoomId) renderModal();
});

function activeSlots(id){
  const now = new Date();
  return bookings.filter(b => b.roomId === id && new Date(b.to) > now);
}

function statusOf(id){
  const slots = activeSlots(id);
  if(slots.length === 0) return 'free';
  const s1 = slots.filter(b => b.courseStage === 'stage1').length;
  const s2 = slots.filter(b => b.courseStage === 'stage2').length;
  const m1 = slots.some(b => b.courseStage === 'stage1' && b.subject?.includes('(Вся аудиторія)'));
  const m2 = slots.some(b => b.courseStage === 'stage2' && b.subject?.includes('(Вся аудиторія)'));
  if((s1 >= STAGE_MAX_SLOTS || m1) && (s2 >= STAGE_MAX_SLOTS || m2)) return 'busy';
  return 'partial';
}

function isStageFull(roomId, stage) {
  const slots = activeSlots(roomId).filter(b => b.courseStage === stage);
  if(slots.length >= STAGE_MAX_SLOTS) return true;
  if(slots.some(b => b.subject?.includes('(Вся аудиторія)'))) return true;
  return false;
}

function updateMapColors() {
  ALL_ROOMS.forEach(r => {
    const el = document.getElementById(`map-${r.id}`);
    if (el) {
      const status = statusOf(r.id);
      if (status === 'free') { 
        el.style.fill = 'var(--accent)'; 
        el.style.stroke = 'none'; 
      }
      else if (status === 'partial') { 
        el.style.fill = 'transparent'; 
        el.style.stroke = 'var(--accent)'; 
      }
      else if (status === 'busy') { 
        el.style.fill = 'transparent'; 
        el.style.stroke = 'var(--busy-border)'; 
      }
      
      const group = document.getElementById(`group-${r.id}`);
      if (group) {
        const txt = group.querySelector('text');
        if (txt) {
          txt.style.fill = status === 'free' ? 'var(--free-text)' : 'var(--accent)';
          if(status === 'busy') txt.style.fill = 'var(--busy-text)';
        }
      }
    }
  });
}

function getCleanSubject(subjectText) {
  if (!subjectText) return "";
  let clean = subjectText.replace(/ЗАБЛОКОВАНО\s*/i, '').replace(/\s*\(Вся аудиторія\)/i, '').trim();
  return clean || "Перегляд";
}

function generateCardHtml(r) {
  const st = statusOf(r.id);
  const slots = activeSlots(r.id);
  const s1 = slots.filter(b => b.courseStage === 'stage1');
  const s2 = slots.filter(b => b.courseStage === 'stage2');
  
  const getStageHtml = (list) => {
    if(!list.length) return '';
    const isMonopoly = list.some(b => b.subject?.includes('(Вся аудиторія)'));
    if(isMonopoly) {
      const b = list.find(b => b.subject?.includes('(Вся аудиторія)'));
      const cleanSubject = getCleanSubject(b.subject);
      return `<div class="room-next-item"><b>${cleanSubject}</b> · ${b.teacher.split(' ')[0]} (вся)</div>`;
    }
    return list.map(b => `<div class="room-next-item">${b.subject} · ${b.teacher.split(' ')[0]}</div>`).join('');
  };

  return `
    <div class="room-card ${st}" onclick="openModal('${r.id}')">
      <div class="card-header">
        <div class="room-num">${r.id.startsWith('cor') ? (r.name.includes('1') ? 'L1' : r.name.includes('2') ? 'L2' : 'C') : r.name}</div>
        <div class="room-type">${r.type}</div>
      </div>
      <div class="card-divider"></div>
      <div class="room-bks-list">
        ${s1.length ? `<div><div class="stage-group-title">1-2 курси:</div>${getStageHtml(s1)}</div>` : ''}
        ${s2.length ? `<div><div class="stage-group-title">3-5 курси:</div>${getStageHtml(s2)}</div>` : ''}
      </div>
    </div>
  `;
}

function render(){
  document.getElementById('rooms-grid').innerHTML = ROOMS.map(r => generateCardHtml(r)).join('');
  document.getElementById('cor-grid').innerHTML = CORRIDORS.map(c => generateCardHtml(c)).join('');
}

window.openModal = function(rid){
  selectedRoomId = rid; editId = null;
  
  const s1Full = isStageFull(rid, 'stage1');
  const s2Full = isStageFull(rid, 'stage2');
  
  if (s1Full && !s2Full) selectedStagesForm = ['stage2'];
  else if (!s1Full && s2Full) selectedStagesForm = ['stage1'];
  else selectedStagesForm = ['stage1'];

  document.getElementById('overlay').classList.add('open');
  document.body.classList.add('modal-open');
  renderModal();
};

window.closeModal = function(){
  document.getElementById('overlay').classList.remove('open');
  document.body.classList.remove('modal-open');
  selectedRoomId = null;
};

window.handleOverlay = (e) => { if(e.target.id==='overlay') closeModal(); };

window.toggleSegment = function(stage) {
  if (isStageFull(selectedRoomId, stage) && !editId) return;
  const idx = selectedStagesForm.indexOf(stage);
  if (idx > -1) { if(selectedStagesForm.length > 1) selectedStagesForm.splice(idx, 1); }
  else { selectedStagesForm.push(stage); }
  renderModal();
};

window.submitBooking = async function(){
  const name = document.getElementById('f-name').value.trim();
  const subject = document.getElementById('f-subject').value.trim();
  if(!name || !subject) return alert('Заповніть ПІБ та Предмет');

  if(editId) {
    const stage = selectedStagesForm[0];
    const b = bookings.find(x => x.id === editId);
    let finalSubject = subject;
    if(b && b.subject?.includes('(Вся аудиторія)')) {
      finalSubject = `ЗАБЛОКОВАНО ${subject} (Вся аудиторія)`.replace(/\s+/g, ' ');
    }
    await updateDoc(doc(db, 'bookings', editId), {
      roomId: selectedRoomId, teacher: name, subject: finalSubject,
      from: STAGE_DATETIME[stage].min, to: STAGE_DATETIME[stage].max,
      courseStage: stage, updatedAt: serverTimestamp()
    });
  } else {
    for (const stage of selectedStagesForm) {
      if (isStageFull(selectedRoomId, stage)) continue;
      await addDoc(collection(db, 'bookings'), {
        roomId: selectedRoomId, teacher: name, subject,
        from: STAGE_DATETIME[stage].min, to: STAGE_DATETIME[stage].max,
        courseStage: stage, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
    }
  }
  editId = null;
  renderModal();
};

window.blockEntireStage = async function(stage) {
  const name = document.getElementById('f-name').value.trim();
  const subject = document.getElementById('f-subject').value.trim();
  if(!name) return alert('Вкажіть ПІБ викладача');
  if(!subject) return alert('Вкажіть назву предмету перед блокуванням всієї аудиторії');
  
  if (isStageFull(selectedRoomId, stage)) return alert('Цей етап уже зайнятий повністю!');
  
  const blockSubject = `ЗАБЛОКОВАНО ${subject} (Вся аудиторія)`;
  if(!confirm('Забронювати всю зону/аудиторію?')) return;
  
  for(let i=0; i<STAGE_MAX_SLOTS; i++) {
    await addDoc(collection(db, 'bookings'), {
      roomId: selectedRoomId, teacher: name, subject: blockSubject,
      from: STAGE_DATETIME[stage].min, to: STAGE_DATETIME[stage].max,
      courseStage: stage, createdAt: serverTimestamp()
    });
  }
  renderModal();
};

window.deleteBooking = async function(id, isMonopoly, stage){
  if(!confirm('Видалити бронювання?')) return;
  if(isMonopoly) {
    const records = bookings.filter(b => b.roomId === selectedRoomId && b.courseStage === stage);
    for(const r of records) await deleteDoc(doc(db, 'bookings', r.id));
  } else {
    await deleteDoc(doc(db, 'bookings', id));
  }
};

window.startEdit = (id) => { 
  editId = id; 
  const b = bookings.find(x => x.id === id);
  selectedStagesForm = [b.courseStage];
  renderModal(); 
};

function renderModal(){
  const room = ALL_ROOMS.find(r => r.id === selectedRoomId);
  const bks = bookings.filter(b => b.roomId === selectedRoomId).sort((a,b)=>new Date(a.from)-new Date(b.from));
  
  const s1Full = isStageFull(selectedRoomId, 'stage1');
  const s2Full = isStageFull(selectedRoomId, 'stage2');
  const allFull = s1Full && s2Full;

  let eb = editId ? bookings.find(b => b.id === editId) : null;
  
  let displaySubject = '';
  if (eb) {
    displaySubject = getCleanSubject(eb.subject);
  }

  document.getElementById('modal').innerHTML = `
    <div class="modal-header">
      <div class="modal-title-row">
        <div class="modal-room-id">${room.name}</div>
        <button class="close-btn" onclick="closeModal()">✕</button>
      </div>
      <div style="font-size:12px; color:#666; margin-top:4px; text-transform:uppercase; letter-spacing:0.1em;">${room.type}</div>
    </div>
    <div class="modal-body">
      <div class="field">
        <label>Курси / Етапи</label>
        <div class="segmented-control">
          <button class="segment-btn ${selectedStagesForm.includes('stage1')?'active':''}" 
                  onclick="toggleSegment('stage1')" 
                  ${(s1Full && !editId) ? 'disabled' : ''}>
            1-2 курси ${s1Full && !editId ? '🔒' : ''}
          </button>
          <button class="segment-btn ${selectedStagesForm.includes('stage2')?'active':''}" 
                  onclick="toggleSegment('stage2')" 
                  ${(s2Full && !editId) ? 'disabled' : ''}>
            3-5 курси ${s2Full && !editId ? '🔒' : ''}
          </button>
        </div>
      </div>
      
      ${allFull && !editId ? `
        <div class="no-slots-msg">Всі місця на цей перегляд зайняті</div>
      ` : `
        <div class="field">
          <label>Викладач (ПІБ)</label>
          <input id="f-name" type="text" placeholder="Прізвище І.Б." value="${eb?eb.teacher:''}">
        </div>
        <div class="field">
          <label>Предмет / Захід</label>
          <input id="f-subject" type="text" placeholder="Назва дисципліни" value="${eb?displaySubject:''}">
        </div>
        
        <button class="btn primary" onclick="submitBooking()" ${allFull && !editId ? 'disabled' : ''}>${editId?'Зберегти':'Забронювати місце'}</button>
        ${!editId ? `
          <button class="btn warning" onclick="blockEntireStage('${selectedStagesForm[0]}')" ${isStageFull(selectedRoomId, selectedStagesForm[0]) ? 'disabled' : ''}>Зайняти всю аудиторію</button>
        ` : ''}
      `}

      <div class="section-label" style="margin-top:40px">Активні записи</div>
      ${bks.map(b => {
        const isMono = b.subject?.includes('(Вся аудиторія)');
        if(isMono && bks.indexOf(b) !== bks.findIndex(x => x.courseStage === b.courseStage && x.subject?.includes('(Вся аудиторія)'))) return '';
        
        const cleanName = getCleanSubject(b.subject);

        return `
          <div class="bk-item ${isMono?'monopoly':''}">
            <div class="bk-name">${cleanName}</div>
            <div class="bk-meta">👤 ${b.teacher}</div>
            <div class="bk-meta">📅 ${b.courseStage==='stage1'?'1-2 курси':'3-5 курси'}</div>
            <div class="bk-actions">
              <button class="bk-btn" onclick="startEdit('${b.id}')">Редагувати</button>
              <button class="bk-btn danger" onclick="deleteBooking('${b.id}', ${isMono}, '${b.courseStage}')">Видалити</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  ALL_ROOMS.forEach(r => {
    const group = document.getElementById(`group-${r.id}`);
    if (group && group.classList.contains('interactive')) {
      group.addEventListener('click', () => openModal(r.id));
    }
  });
  updateMapColors();

  const themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      document.documentElement.classList.toggle('light-theme');
      const theme = document.documentElement.classList.contains('light-theme') ? 'light' : 'dark';
      localStorage.setItem('theme', theme);
    });
  }
});
