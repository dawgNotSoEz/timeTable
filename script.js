        document.addEventListener('DOMContentLoaded', function() {
            // --- Element Selectors ---
            const modal = document.getElementById('task-modal');
            const closeModalBtn = document.querySelector('.close-button');
            const saveBtn = document.getElementById('save-btn');
            const classItems = document.querySelectorAll('.class-item');
            const modalTitle = document.getElementById('modal-title');
            const taskInput = document.getElementById('task-input');
            const addTaskBtn = document.getElementById('add-task-btn');
            const taskList = document.getElementById('task-list');
            const notesArea = document.getElementById('notes-area');
            const clockElement = document.getElementById('clock');
            const viewButtons = document.querySelectorAll('.view-controls button');
            const container = document.querySelector('.container');
            const reminderDateInput = document.getElementById('reminder-date');
            const reminderToggle = document.getElementById('reminder-toggle');
            const generatePlanBtn = document.getElementById('generate-plan-btn');
            const summarizeNotesBtn = document.getElementById('summarize-notes-btn');
            const geminiLoader = document.getElementById('gemini-loader');

            // --- State Management ---
            let currentItemId = null;
            let classData = {};

            // --- Gemini API Function ---
            async function callGemini(prompt) {
                geminiLoader.style.display = 'block';
                let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
                const payload = { contents: chatHistory };
                const apiKey = ""; // API key will be injected by the environment
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                
                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    
                    if (!response.ok) {
                        throw new Error(`API request failed with status ${response.status}`);
                    }

                    const result = await response.json();
                    
                    if (result.candidates && result.candidates.length > 0 &&
                        result.candidates[0].content && result.candidates[0].content.parts &&
                        result.candidates[0].content.parts.length > 0) {
                        return result.candidates[0].content.parts[0].text;
                    } else {
                        // Check for safety ratings or other issues
                        console.error("Gemini API response structure unexpected or content blocked:", result);
                        return "Sorry, I couldn't generate a response. It might have been blocked for safety reasons.";
                    }
                } catch (error) {
                    console.error("Error calling Gemini API:", error);
                    return "Sorry, an error occurred while contacting the AI. Please check the console for details.";
                } finally {
                    geminiLoader.style.display = 'none';
                }
            }


            // --- Core Functions ---
            function updateClock() {
                const now = new Date();
                const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' };
                const dateString = now.toLocaleDateString('en-US', options);
                const timeString = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' });
                clockElement.innerHTML = `${dateString}<br>${timeString} (IST)`;
            }

            function loadAllData() {
                classItems.forEach(item => {
                    const id = item.id;
                    if (!id) return;
                    const data = localStorage.getItem(id);
                    if (data) {
                        try {
                           classData[id] = JSON.parse(data);
                        } catch(e) {
                            console.error(`Could not parse JSON for item ${id}:`, data);
                        }
                    }
                });
                checkReminders();
            }

            function renderTasks(itemId) {
                taskList.innerHTML = '';
                const data = classData[itemId];
                if (data && data.tasks) {
                    data.tasks.forEach((task, index) => {
                        const li = document.createElement('li');
                        li.dataset.index = index;
                        if (task.completed) li.classList.add('completed');
                        
                        let taskHTML = `<span>${task.text}</span>`;
                        if(task.reminderActive && task.reminderDate) {
                            taskHTML += `<span class="task-date"> (Due: ${task.reminderDate})</span>`;
                        }
                        taskHTML += `<button class="delete-task" title="Delete Task">✖</button>`;
                        li.innerHTML = taskHTML;
                        taskList.appendChild(li);
                    });
                }
            }

            function openModal(item) {
                currentItemId = item.id;
                const spec = item.dataset.spec;
                let titlePrefix = '';
                if (spec === 'CS') titlePrefix = 'Cyber Security: ';
                if (spec === 'CC') titlePrefix = 'Cloud Computing: ';
                const subjectSpan = item.querySelector('.subject');
                modalTitle.innerHTML = subjectSpan ? titlePrefix + subjectSpan.outerHTML : 'Details';

                const data = classData[currentItemId] || {};
                notesArea.value = data.notes || '';
                renderTasks(currentItemId);

                modal.style.display = 'block';
                taskInput.focus();
            }

            function closeModalFunction() {
                if (currentItemId) {
                    const data = classData[currentItemId] || {};
                    data.notes = notesArea.value;
                    
                    if ((data.tasks && data.tasks.length > 0) || (data.notes && data.notes.trim() !== '')) {
                         localStorage.setItem(currentItemId, JSON.stringify(data));
                    } else {
                        localStorage.removeItem(currentItemId);
                        delete classData[currentItemId];
                    }
                }
                modal.style.display = 'none';
                clearModalInputs();
                checkReminders();
            }
            
            function clearModalInputs() {
                taskInput.value = '';
                taskList.innerHTML = '';
                notesArea.value = '';
                reminderDateInput.value = '';
                reminderToggle.checked = false;
                currentItemId = null;
            }

            function addTask() {
                const taskText = taskInput.value.trim();
                if (taskText === '' || !currentItemId) return;

                const task = {
                    text: taskText,
                    completed: false,
                    reminderDate: reminderDateInput.value,
                    reminderActive: reminderToggle.checked
                };

                if (!classData[currentItemId]) classData[currentItemId] = { tasks: [], notes: '' };
                if (!classData[currentItemId].tasks) classData[currentItemId].tasks = [];

                classData[currentItemId].tasks.push(task);
                renderTasks(currentItemId);

                taskInput.value = '';
                reminderDateInput.value = '';
                reminderToggle.checked = false;
                taskInput.focus();
            }

            function handleTaskListClick(e) {
                const li = e.target.closest('li');
                if (!li || !currentItemId) return;
                
                const index = parseInt(li.dataset.index, 10);
                const tasks = classData[currentItemId].tasks;

                if (e.target.classList.contains('delete-task')) {
                    tasks.splice(index, 1);
                } else if (e.target.tagName === 'SPAN') {
                    tasks[index].completed = !tasks[index].completed;
                }
                renderTasks(currentItemId);
            }
            
            function checkReminders() {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);

                classItems.forEach(item => {
                    const id = item.id;
                    const data = classData[id];
                    let hasReminder = false;
                    if (data && data.tasks) {
                        hasReminder = data.tasks.some(task => {
                            if (!task.reminderActive || !task.reminderDate) return false;
                            const reminderDate = new Date(task.reminderDate + 'T00:00:00');
                            return reminderDate.getTime() === tomorrow.getTime();
                        });
                    }
                    if (hasReminder) {
                        item.classList.add('reminder-alert');
                    } else {
                        item.classList.remove('reminder-alert');
                    }
                });
            }

            // --- Gemini Feature Functions ---
            async function generateStudyPlan() {
                if (!currentItemId) return;
                const data = classData[currentItemId];
                const subject = document.getElementById(currentItemId)?.querySelector('.subject')?.textContent || 'this class';

                if (!data || !data.tasks || data.tasks.length === 0) {
                    notesArea.value = "Add some tasks to your to-do list first, then I can generate a study plan!";
                    return;
                }

                const taskListString = data.tasks.map(t => `- ${t.text}${t.reminderDate ? ` (Due: ${t.reminderDate})` : ''}`).join('\n');
                const prompt = `You are an expert academic planner. For a college-level class on "${subject}", create a detailed study plan to prepare for the following tasks:\n${taskListString}\n\nBreak down the plan into manageable daily or weekly sessions. Suggest specific topics to focus on for each session. The current date is ${new Date().toLocaleDateString()}.`;
                
                const plan = await callGemini(prompt);
                notesArea.value += `\n\n--- AI Study Plan ---\n${plan}`;
            }

            async function summarizeNotes() {
                if (!currentItemId) return;
                const subject = document.getElementById(currentItemId)?.querySelector('.subject')?.textContent || 'this class';
                const currentNotes = notesArea.value;

                if (currentNotes.trim().length < 50) { // Don't summarize very short notes
                    alert("Not enough text to summarize. Write some more notes first!");
                    return;
                }

                const prompt = `Please summarize the following academic notes for a "${subject}" class into concise key points using bullet points:\n\n---\n${currentNotes}\n---`;
                const summary = await callGemini(prompt);
                notesArea.value = `--- AI Summary ---\n${summary}\n\n--- Original Notes ---\n${currentNotes}`;
            }

            // --- Initial Setup & Event Listeners ---
            setInterval(updateClock, 1000);
            updateClock();
            loadAllData();
            setInterval(checkReminders, 60000);

            classItems.forEach(item => {
                if (item.querySelector('.subject')) {
                    item.addEventListener('click', () => openModal(item));
                } else {
                    item.style.cursor = 'default';
                }
            });

            viewButtons.forEach(button => {
                button.addEventListener('click', () => {
                    viewButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    container.className = 'container'; 
                    const view = button.dataset.view;
                    if (view === 'cs') container.classList.add('view-cs');
                    else if (view === 'cc') container.classList.add('view-cc');
                });
            });

            closeModalBtn.onclick = closeModalFunction;
            saveBtn.onclick = closeModalFunction;
            window.onclick = (event) => { if (event.target == modal) closeModalFunction(); };
            addTaskBtn.addEventListener('click', addTask);
            taskList.addEventListener('click', handleTaskListClick);
            generatePlanBtn.addEventListener('click', generateStudyPlan);
            summarizeNotesBtn.addEventListener('click', summarizeNotes);
        });