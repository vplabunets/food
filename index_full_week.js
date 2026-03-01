const { Telegraf, Markup } = require('telegraf')
const XLSX = require('xlsx')
const fs = require('fs')

const BOT_TOKEN = '8743943704:AAGaNobtYvw2XlOXA81BwZ_w4Mysobbkeuw'
const ADMIN_ID = 627658894

const bot = new Telegraf(BOT_TOKEN)

let weekMenuFromFile = {}     // меню на весь тиждень
let userSessions = {}
let orders = []               // { userId, name, date, type, items:{перше,друге,салат}, timestamp }

// ===================================================
// ДОПОМІЖНІ ФУНКЦІЇ
// ===================================================
function parseDate(dateRaw) {
	if (!dateRaw) return null
	if (typeof dateRaw === 'number') {
		const d = XLSX.SSF.parse_date_code(dateRaw)
		return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
	}
	const str = String(dateRaw)
	const match = str.match(/(\d{2}).(\d{2}).(\d{4})/)
	return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

function normalizeType(raw) {
	const t = String(raw || '').trim().toLowerCase()
	if (t.includes('звичайн')) return 'звичайне'
	if (t.includes('дієт')) return 'дієта'
	if (t.includes('піст') || t.includes('пост')) return 'піст'
	return null
}

function formatDateForUser(isoDate) {
	const d = new Date(isoDate)
	const days = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
	return `${days[d.getUTCDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getToday() {
	return new Date().toISOString().split('T')[0]
}

function getAvailableDays() {
	return Object.keys(weekMenuFromFile).sort().map(date => ({
		date,
		display: formatDateForUser(date)
	}))
}

// ===================================================
// АДМІН — завантаження меню
// ===================================================
bot.command('uploadmenu', (ctx) => {
	if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ Тільки для адміністратора.')
	ctx.reply('📎 Надішліть Excel файл (.xlsx)\nСтруктура: ДАТА | ТИП | ПЕРШЕ | ДРУГЕ | САЛАТ', { parse_mode: 'Markdown' })
})

bot.on('document', async (ctx) => {
	if (ctx.from.id !== ADMIN_ID) return
	const doc = ctx.message.document
	if (!doc.file_name.endsWith('.xlsx')) return ctx.reply('⚠️ Потрібен .xlsx файл')
	
	await ctx.reply('⏳ Обробляю файл...')
	
	try {
		const fileLink = await ctx.telegram.getFileLink(doc.file_id)
		const res = await fetch(fileLink.href)
		const buffer = Buffer.from(await res.arrayBuffer())
		
		const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
		const sheet = wb.Sheets[wb.SheetNames[0]]
		const range = XLSX.utils.decode_range(sheet['!ref'])
		
		function getCell(r, c) {
			const cell = sheet[XLSX.utils.encode_cell({ r, c })]
			return cell ? cell.v : null
		}
		
		const parsed = {}
		let lastDate = null
		
		for (let r = 0; r <= range.e.r; r++) {
			const dateRaw = getCell(r, 0)
			const typeRaw = getCell(r, 1)
			const perche = getCell(r, 2)
			const druge = getCell(r, 3)
			const salat = getCell(r, 4)
			
			const dateKey = parseDate(dateRaw)
			if (dateKey) lastDate = dateKey
			
			const type = normalizeType(typeRaw)
			if (!type || !perche || !lastDate) continue
			
			if (!parsed[lastDate]) parsed[lastDate] = {}
			parsed[lastDate][type] = {
				перше: String(perche).trim(),
				друге: druge ? String(druge).trim() : '',
				салат: salat ? String(salat).trim() : ''
			}
		}
		
		weekMenuFromFile = parsed
		ctx.reply(`✅ Меню на тиждень завантажено!\nДнів з меню: ${Object.keys(parsed).length}`)
	} catch (e) {
		ctx.reply('❌ Помилка: ' + e.message)
	}
})

// ===================================================
// АДМІН — список усіх замовлень (залишив для дебагу)
// ===================================================
bot.command('orders', async (ctx) => {
	if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ Тільки для адміністратора.')
	if (orders.length === 0) return ctx.reply('📭 Замовлень немає.')
	
	// 1. Усі унікальні дати, відсортовані
	const allDates = [...new Set(orders.map(o => o.date))].sort();
	
	// 2. Групуємо дані по людях
	const byPerson = {};
	orders.forEach(o => {
		if (!byPerson[o.name]) byPerson[o.name] = {};
		byPerson[o.name][o.date] = {
			type: o.type,
			items: { ...o.items }
		};
	});
	
	// 3. Формуємо заголовки (два рядки)
	const headerRow1 = ['ПІБ'];  // перший рядок — об’єднані дати + ПІБ
	const headerRow2 = [''];      // другий рядок — Тип | Страви під кожним днем
	
	const merges = [];  // для об’єднання клітинок у першому рядку
	
	allDates.forEach((date, index) => {
		const dayLabel = formatDateForUser(date);
		// Об’єднуємо дві клітинки над "Тип" і "Страви"
		merges.push({
			s: { r: 0, c: 1 + index * 2 },     // початок об’єднання
			e: { r: 0, c: 2 + index * 2 }      // кінець (на дві колонки)
		});
		headerRow1.push(dayLabel);
		headerRow1.push('');  // порожня клітинка під об’єднаним заголовком
		
		headerRow2.push('Тип');
		headerRow2.push('Страви');
	});
	
	// 4. Дані
	const rows = [];
	Object.keys(byPerson).sort().forEach(name => {
		const row = [name];
		
		allDates.forEach(date => {
			const order = byPerson[name][date];
			
			if (!order) {
				row.push('—');
				row.push('—');
				return;
			}
			
			// Тип меню
			let typeDisplay = '—';
			if (order.type === 'звичайне') typeDisplay = 'Звичайне';
			else if (order.type === 'дієта')    typeDisplay = 'Дієта';
			else if (order.type === 'піст')      typeDisplay = 'Піст';
			row.push(typeDisplay);
			
			// Страви
			const parts = [];
			if (order.items.перше) parts.push('П');
			if (order.items.друге) parts.push('Д');
			if (order.items.салат)  parts.push('С');
			const itemsDisplay = parts.length > 0 ? parts.join(' ') : '—';
			row.push(itemsDisplay);
		});
		
		rows.push(row);
	});
	
	// 5. Excel з двома рядками заголовків
	const wsData = [headerRow1, headerRow2, ...rows];
	const ws = XLSX.utils.aoa_to_sheet(wsData);
	
	// Застосовуємо об’єднання клітинок
	ws['!merges'] = merges;
	
	// Ширина колонок
	ws['!cols'] = [
		{ wch: 28 },  // ПІБ
		...allDates.flatMap(() => [{ wch: 14 }, { wch: 12 }])  // Тип | Страви
	];
	
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, 'Замовлення');
	
	const filePath = '/tmp/orders_split.xlsx';
	XLSX.writeFile(wb, filePath);
	
	await ctx.replyWithDocument(
		{ source: filePath, filename: 'замовлення_по_днях.xlsx' },
		{ caption: `Замовлення по днях\nКожен день — дві колонки (Тип + Страви)\nСпівробітників: ${Object.keys(byPerson).length}` }
	);
	
	setTimeout(() => fs.unlink(filePath, () => {}), 60000);
});
// ===================================================
// КОМАНДА /kitchen — Excel-файл для кухні НА СЬОГОДНІ
// ===================================================
bot.command('kitchen', async (ctx) => {
	if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ Тільки для адміністратора.')
	
	const today = getToday()
	const todayOrders = orders.filter(o => o.date === today)
	
	if (todayOrders.length === 0) {
		return ctx.reply(`На сьогодні (${formatDateForUser(today)}) ще немає замовлень.`)
	}
	
	// 1. Підрахунок порцій по кожній страві
	const counts = {
		usual:   { first: 0, second: 0, salad: 0 },
		diet:    { first: 0, second: 0, salad: 0 },
		fasting: { first: 0, second: 0, salad: 0 }
	}
	
	todayOrders.forEach(o => {
		const t = o.type
		const i = o.items
		if (t === 'звичайне') {
			if (i.перше) counts.usual.first++
			if (i.друге) counts.usual.second++
			if (i.салат) counts.usual.salad++
		} else if (t === 'дієта') {
			if (i.перше) counts.diet.first++
			if (i.друге) counts.diet.second++
			if (i.салат) counts.diet.salad++
		} else if (t === 'піст') {
			if (i.перше) counts.fasting.first++
			if (i.друге) counts.fasting.second++
			if (i.салат) counts.fasting.salad++
		}
	})
	
	// Аркуш 1 — Що готувати сьогодні (основний для кухні)
	const summaryData = [
		['Тип меню', 'Страва', 'Кількість порцій'],
		['Звичайне', 'Перше', counts.usual.first],
		['Звичайне', 'Друге', counts.usual.second],
		['Звичайне', 'Салат', counts.usual.salad],
		['Дієта',    'Перше', counts.diet.first],
		['Дієта',    'Друге', counts.diet.second],
		['Дієта',    'Салат', counts.diet.salad],
		['Піст',     'Перше', counts.fasting.first],
		['Піст',     'Друге', counts.fasting.second],
		['Піст',     'Салат', counts.fasting.salad],
		['Всього порцій на сьогодні', '', todayOrders.length]
	]
	
	// Аркуш 2 — Деталі (хто що замовив)
	const detailsData = [['ПІБ', 'Тип', 'Перше', 'Друге', 'Салат']]
	todayOrders.forEach(o => {
		detailsData.push([
			o.name,
			o.type.charAt(0).toUpperCase() + o.type.slice(1),
			o.items.перше ? 'Так' : '—',
			o.items.друге ? 'Так' : '—',
			o.items.салат  ? 'Так' : '—'
		])
	})
	
	// Створюємо Excel-файл
	const wb = XLSX.utils.book_new()
	
	const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
	wsSummary['!cols'] = [{wch: 14}, {wch: 35}, {wch: 16}]
	XLSX.utils.book_append_sheet(wb, wsSummary, 'Що готувати')
	
	const wsDetails = XLSX.utils.aoa_to_sheet(detailsData)
	wsDetails['!cols'] = [{wch: 30}, {wch: 12}, {wch: 8}, {wch: 8}, {wch: 8}]
	XLSX.utils.book_append_sheet(wb, wsDetails, 'По людям')
	
	const filePath = '/tmp/kitchen_today.xlsx'
	XLSX.writeFile(wb, filePath)
	
	await ctx.replyWithDocument(
		{ source: filePath, filename: `кухня_${today}.xlsx` },
		{ caption: `🍲 Кухня на сьогодні (${formatDateForUser(today)})\nЗамовлень: ${todayOrders.length}` }
	)
	
	// Видаляємо файл через 1 хвилину (щоб не захаращувати диск)
	setTimeout(() => fs.unlink(filePath, () => {}), 60000)
})

// ===================================================
// ЛОГІКА ЗАМОВЛЕННЯ ДЛЯ КОРИСТУВАЧІВ (без змін)
// ===================================================
bot.command('start', (ctx) => {
	const uid = ctx.from.id
	userSessions[uid] = { step: 'waiting_name', name: '', selectedDays: {} }
	ctx.reply("👋 Вітаємо!\n\nВведіть своє *ім'я та прізвище*:", { parse_mode: 'Markdown' })
})

bot.on('text', (ctx) => {
	const uid = ctx.from.id
	const session = userSessions[uid]
	if (!session || session.step !== 'waiting_name') return
	
	const name = ctx.message.text.trim()
	if (name.length < 2) return ctx.reply("⚠️ Введіть справжнє ім'я (мінімум 2 символи)")
	
	session.name = name
	session.step = 'choosing_day'
	showDaysList(ctx, uid)
})

function showDaysList(ctx, uid) {
	const session = userSessions[uid]
	const days = getAvailableDays()
	
	let text = `👤 *${session.name}*\n\nОберіть день для замовлення:\n\n`
	const buttons = days.map(day => {
		const has = session.selectedDays[day.date]
		return [Markup.button.callback(has ? `✅ ${day.display}` : `☐ ${day.display}`, `select_day:${day.date}`)]
	})
	buttons.push([Markup.button.callback('✅ Завершити всі замовлення', 'finish_all')])
	
	ctx.editMessageText(text, {
		parse_mode: 'Markdown',
		reply_markup: Markup.inlineKeyboard(buttons).reply_markup
	}).catch(() => ctx.reply(text, {
		parse_mode: 'Markdown',
		reply_markup: Markup.inlineKeyboard(buttons).reply_markup
	}))
}

bot.action(/^select_day:(.+)$/, (ctx) => {
	const uid = ctx.from.id
	const date = ctx.match[1]
	userSessions[uid].currentEditingDay = date
	ctx.answerCbQuery()
	showTypeSelection(ctx, uid, date)
})

function showTypeSelection(ctx, uid, date) {
	const display = formatDateForUser(date)
	ctx.editMessageText(`📅 *${display}*\n\nОберіть тип меню:`, {
		parse_mode: 'Markdown',
		reply_markup: Markup.inlineKeyboard([
			[Markup.button.callback('🍽 Звичайне', `day_type:${date}:звичайне`)],
			[Markup.button.callback('🥦 Дієта', `day_type:${date}:дієта`)],
			[Markup.button.callback('🙏 Піст', `day_type:${date}:піст`)],
			[Markup.button.callback('🔙 Назад', 'back_to_days')]
		]).reply_markup
	})
}

bot.action(/^day_type:(.+):(.+)$/, (ctx) => {
	const uid = ctx.from.id
	const [date, type] = ctx.match.slice(1)
	const session = userSessions[uid]
	
	if (!session.selectedDays[date]) session.selectedDays[date] = {}
	session.selectedDays[date].type = type
	session.selectedDays[date].items = { перше: true, друге: true, салат: true }
	
	ctx.answerCbQuery()
	showItemsForDay(ctx, uid, date)
})

function showItemsForDay(ctx, uid, date) {
	const session = userSessions[uid]
	const dayOrder = session.selectedDays[date]
	const menuDay = weekMenuFromFile[date]?.[dayOrder.type]
	
	if (!menuDay) return ctx.editMessageText('❌ Немає меню цього типу на цей день')
	
	const check = v => v ? '✅' : '☐'
	let text = `📅 *${formatDateForUser(date)}* — ${dayOrder.type.toUpperCase()}\n\n`
	text += `${check(dayOrder.items.перше)} Перше: ${menuDay.перше}\n`
	text += `${check(dayOrder.items.друге)} Друге: ${menuDay.друге || '—'}\n`
	text += `${check(dayOrder.items.салат)} Салат: ${menuDay.салат || '—'}\n\n`
	text += 'Натискайте для зміни'
	
	const kb = Markup.inlineKeyboard([
		[Markup.button.callback(`${check(dayOrder.items.перше)} Перше`, `toggle_item:${date}:перше`)],
		[Markup.button.callback(`${check(dayOrder.items.друге)} Друге`, `toggle_item:${date}:друге`)],
		[Markup.button.callback(`${check(dayOrder.items.салат)} Салат`, `toggle_item:${date}:салат`)],
		[Markup.button.callback('✅ Підтвердити день', `confirm_day:${date}`)],
		[Markup.button.callback('🔙 Змінити тип', `select_day:${date}`)]
	])
	
	ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb.reply_markup })
}

bot.action(/^toggle_item:(.+):(.+)$/, (ctx) => {
	const uid = ctx.from.id
	const [date, item] = ctx.match.slice(1)
	const session = userSessions[uid]
	if (session.selectedDays[date]) {
		session.selectedDays[date].items[item] = !session.selectedDays[date].items[item]
	}
	ctx.answerCbQuery()
	showItemsForDay(ctx, uid, date)
})

bot.action(/^confirm_day:(.+)$/, (ctx) => {
	ctx.answerCbQuery('День збережено ✓')
	showDaysList(ctx, ctx.from.id)
})

bot.action('back_to_days', (ctx) => {
	ctx.answerCbQuery()
	showDaysList(ctx, ctx.from.id)
})

bot.action('finish_all', async (ctx) => {
	const uid = ctx.from.id
	const session = userSessions[uid]
	const dates = Object.keys(session.selectedDays)
	
	if (dates.length === 0) return ctx.answerCbQuery('Ви нічого не замовили!', { show_alert: true })
	
	let summary = `✅ *Замовлення прийнято!*\n\n👤 ${session.name}\n\n`
	dates.forEach(date => {
		const o = session.selectedDays[date]
		const itemsList = Object.entries(o.items).filter(([,v]) => v).map(([k]) => k.charAt(0).toUpperCase()).join('')
		summary += `📅 ${formatDateForUser(date)} — ${o.type} (${itemsList})\n`
		
		orders.push({
			userId: uid,
			name: session.name,
			date,
			type: o.type,
			items: { ...o.items },
			timestamp: new Date().toISOString()
		})
	})
	
	delete userSessions[uid]
	await ctx.editMessageText(summary, { parse_mode: 'Markdown' })
	
	await bot.telegram.sendMessage(ADMIN_ID,
		`🔔 Нове замовлення від ${session.name}!\n\n${summary}`,
		{ parse_mode: 'Markdown' }
	)
})

// ===================================================
bot.launch()
console.log('✅ Бот запущено! /kitchen — Excel для кухні на сьогодні')
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
