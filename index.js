// const { Telegraf, Markup } = require('telegraf')
// const XLSX = require('xlsx')
//
// const BOT_TOKEN = '8743943704:AAGaNobtYvw2XlOXA81BwZ_w4Mysobbkeuw'
// const ADMIN_ID = 627658894
//
// const bot = new Telegraf(BOT_TOKEN)
//
// let weekMenuFromFile = {}   // меню на весь тиждень
// let adminSession = {}
// let userSessions = {}
// let orders = []             // масив: {name, date, type, items, userId, timestamp}
//
// // ===================================================
// // ДОПОМІЖНІ ФУНКЦІЇ
// // ===================================================
// function parseDate(dateRaw) {
// 	if (!dateRaw) return null
// 	if (typeof dateRaw === 'number') {
// 		const d = XLSX.SSF.parse_date_code(dateRaw)
// 		return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
// 	}
// 	const str = String(dateRaw)
// 	const match = str.match(/(\d{2}).(\d{2}).(\d{4})/)
// 	return match ? `${match[3]}-${match[2]}-${match[1]}` : null
// }
//
// function normalizeType(raw) {
// 	const t = String(raw || '').trim().toLowerCase()
// 	if (t.includes('звичайн')) return 'звичайне'
// 	if (t.includes('дієт')) return 'дієта'
// 	if (t.includes('піст') || t.includes('пост')) return 'піст'
// 	return null
// }
//
// function formatDateForUser(isoDate) {
// 	const d = new Date(isoDate)
// 	const days = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
// 	return `${days[d.getUTCDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
// }
//
// function getAvailableDays() {
// 	return Object.keys(weekMenuFromFile).sort().map(date => ({
// 		date,
// 		display: formatDateForUser(date)
// 	}))
// }
//
// // ===================================================
// // АДМІН ЧАСТИНА (без змін)
// // ===================================================
// bot.command('setmenu', (ctx) => {
// 	if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ Тільки для адміністратора.')
// 	// ... (залишаю стару логіку ручного введення, якщо треба)
// 	ctx.reply('Ручне введення поки вимкнено. Використовуйте /uploadmenu')
// })
//
// bot.command('uploadmenu', (ctx) => {
// 	if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ Тільки для адміністратора.')
// 	ctx.reply('📎 Надішліть Excel файл (.xlsx)\nСтруктура: ДАТА | ТИП | ПЕРШЕ | ДРУГЕ | САЛАТ', { parse_mode: 'Markdown' })
// })
//
// bot.on('document', async (ctx) => {
// 	if (ctx.from.id !== ADMIN_ID) return
// 	const doc = ctx.message.document
// 	if (!doc.file_name.endsWith('.xlsx')) return ctx.reply('⚠️ Потрібен .xlsx файл')
//
// 	await ctx.reply('⏳ Обробляю файл...')
//
// 	try {
// 		const fileLink = await ctx.telegram.getFileLink(doc.file_id)
// 		const res = await fetch(fileLink.href)
// 		const buffer = Buffer.from(await res.arrayBuffer())
//
// 		const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
// 		const sheet = wb.Sheets[wb.SheetNames[0]]
// 		const range = XLSX.utils.decode_range(sheet['!ref'])
//
// 		function getCell(r, c) {
// 			const cell = sheet[XLSX.utils.encode_cell({ r, c })]
// 			return cell ? cell.v : null
// 		}
//
// 		const parsed = {}
// 		let lastDate = null
//
// 		for (let r = 0; r <= range.e.r; r++) {
// 			const dateRaw = getCell(r, 0)
// 			const typeRaw = getCell(r, 1)
// 			const perche = getCell(r, 2)
// 			const druge = getCell(r, 3)
// 			const salat = getCell(r, 4)
//
// 			const dateKey = parseDate(dateRaw)
// 			if (dateKey) lastDate = dateKey
//
// 			const type = normalizeType(typeRaw)
// 			if (!type || !perche || !lastDate) continue
//
// 			if (!parsed[lastDate]) parsed[lastDate] = {}
// 			parsed[lastDate][type] = {
// 				перше: String(perche).trim(),
// 				друге: druge ? String(druge).trim() : '',
// 				салат: salat ? String(salat).trim() : ''
// 			}
// 		}
//
// 		weekMenuFromFile = parsed
//
// 		const today = new Date().toISOString().split('T')[0]
// 		ctx.reply(`✅ Меню на тиждень завантажено!\n\nДнів з меню: ${Object.keys(parsed).length}`, { parse_mode: 'Markdown' })
// 	} catch (e) {
// 		ctx.reply('❌ Помилка: ' + e.message)
// 	}
// })
//
// bot.command('orders', async (ctx) => {
// 	if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ Тільки для адміністратора.')
// 	if (orders.length === 0) return ctx.reply('📭 Замовлень немає.')
//
// 	const data = [['ПІБ', 'Дата', 'Тип', 'Перше', 'Друге', 'Салат']]
// 	orders.forEach(o => {
// 		data.push([
// 			o.name,
// 			formatDateForUser(o.date),
// 			o.type,
// 			o.items.перше ? '✅' : '',
// 			o.items.друге ? '✅' : '',
// 			o.items.салат ? '✅' : ''
// 		])
// 	})
//
// 	const ws = XLSX.utils.aoa_to_sheet(data)
// 	const wb = XLSX.utils.book_new()
// 	XLSX.utils.book_append_sheet(wb, ws, 'Замовлення')
//
// 	const path = '/tmp/orders.xlsx'
// 	XLSX.writeFile(wb, path)
//
// 	await ctx.replyWithDocument({ source: path, filename: 'замовлення.xlsx' },
// 		{ caption: `📊 Всього замовлень: ${orders.length}` })
// })
//
// // ===================================================
// // КОРИСТУВАЧ — /start
// // ===================================================
// bot.command('start', (ctx) => {
// 	const uid = ctx.from.id
// 	userSessions[uid] = {
// 		step: 'waiting_name',
// 		name: '',
// 		selectedDays: {}        // { "2025-03-03": {type, items} }
// 	}
// 	ctx.reply("👋 Вітаємо!\n\nВведіть своє *ім'я та прізвище*:", { parse_mode: 'Markdown' })
// })
//
// // ===================================================
// // ОБРОБКА ТЕКСТУ (введення імені)
// // ===================================================
// bot.on('text', (ctx) => {
// 	const uid = ctx.from.id
// 	const session = userSessions[uid]
//
// 	if (!session || session.step !== 'waiting_name') return
//
// 	const name = ctx.message.text.trim()
// 	if (name.length < 2) return ctx.reply("⚠️ Введіть справжнє ім'я (мінімум 2 символи)")
//
// 	session.name = name
// 	session.step = 'choosing_day'
//
// 	showDaysList(ctx, uid)
// })
//
// // ===================================================
// // ПОКАЗ СПИСКУ ДНІВ
// // ===================================================
// function showDaysList(ctx, uid) {
// 	const session = userSessions[uid]
// 	const days = getAvailableDays()
//
// 	let text = `👤 *${session.name}*\n\n`
// 	text += `Оберіть день для замовлення:\n\n`
//
// 	const buttons = days.map(day => {
// 		const hasOrder = session.selectedDays[day.date]
// 		const status = hasOrder ? `✅ ${hasOrder.type}` : '☐'
// 		return [Markup.button.callback(`${status} ${day.display}`, `select_day:${day.date}`)]
// 	})
//
// 	buttons.push([Markup.button.callback('✅ Завершити всі замовлення', 'finish_all')])
//
// 	ctx.editMessageText(text, {
// 		parse_mode: 'Markdown',
// 		reply_markup: Markup.inlineKeyboard(buttons).reply_markup
// 	}).catch(() => ctx.reply(text, {
// 		parse_mode: 'Markdown',
// 		reply_markup: Markup.inlineKeyboard(buttons).reply_markup
// 	}))
// }
//
// // ===================================================
// // ВИБІР ДНЯ
// // ===================================================
// bot.action(/^select_day:(.+)$/, (ctx) => {
// 	const uid = ctx.from.id
// 	const date = ctx.match[1]
// 	const session = userSessions[uid]
//
// 	session.currentEditingDay = date
// 	session.step = 'choosing_type_for_day'
//
// 	ctx.answerCbQuery()
// 	showTypeSelection(ctx, uid, date)
// })
//
// function showTypeSelection(ctx, uid, date) {
// 	const session = userSessions[uid]
// 	const displayDate = formatDateForUser(date)
//
// 	ctx.editMessageText(`📅 *${displayDate}*\n\nОберіть тип меню:`, {
// 		parse_mode: 'Markdown',
// 		reply_markup: Markup.inlineKeyboard([
// 			[Markup.button.callback('🍽 Звичайне', `day_type:${date}:звичайне`)],
// 			[Markup.button.callback('🥦 Дієта',    `day_type:${date}:дієта`)],
// 			[Markup.button.callback('🙏 Піст',      `day_type:${date}:піст`)],
// 			[Markup.button.callback('🔙 Назад до днів', 'back_to_days')]
// 		]).reply_markup
// 	})
// }
//
// // ===================================================
// // ВИБІР ТИПУ ДЛЯ КОНКРЕТНОГО ДНЯ
// // ===================================================
// bot.action(/^day_type:(.+):(.+)$/, (ctx) => {
// 	const uid = ctx.from.id
// 	const [date, type] = ctx.match.slice(1)
//
// 	const session = userSessions[uid]
// 	if (!session.selectedDays[date]) session.selectedDays[date] = {}
// 	session.selectedDays[date].type = type
// 	session.selectedDays[date].items = { перше: true, друге: true, салат: true }
//
// 	ctx.answerCbQuery()
// 	showItemsForDay(ctx, uid, date)
// })
//
// // ===================================================
// // ПОКАЗ СТРАВ ДЛЯ ДНЯ
// // ===================================================
// function showItemsForDay(ctx, uid, date) {
// 	const session = userSessions[uid]
// 	const dayOrder = session.selectedDays[date]
// 	const menuForDay = weekMenuFromFile[date]?.[dayOrder.type]
//
// 	if (!menuForDay) {
// 		return ctx.editMessageText('❌ Для цього дня немає меню цього типу')
// 	}
//
// 	const check = v => v ? '✅' : '☐'
//
// 	let text = `📅 *${formatDateForUser(date)}*\n`
// 	text += `🍽 ${dayOrder.type.toUpperCase()}\n\n`
// 	text += `${check(dayOrder.items.перше)} Перше: ${menuForDay.перше}\n`
// 	text += `${check(dayOrder.items.друге)} Друге: ${menuForDay.друге || '—'}\n`
// 	text += `${check(dayOrder.items.салат)} Салат: ${menuForDay.салат || '—'}\n\n`
// 	text += 'Натискайте, щоб включити/виключити'
//
// 	const kb = Markup.inlineKeyboard([
// 		[Markup.button.callback(`${check(dayOrder.items.перше)} Перше`, `toggle_item:${date}:перше`)],
// 		[Markup.button.callback(`${check(dayOrder.items.друге)} Друге`, `toggle_item:${date}:друге`)],
// 		[Markup.button.callback(`${check(dayOrder.items.салат)} Салат`, `toggle_item:${date}:салат`)],
// 		[Markup.button.callback('✅ Підтвердити цей день', `confirm_day:${date}`)],
// 		[Markup.button.callback('🔙 Змінити тип', `select_day:${date}`)]
// 	])
//
// 	ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb.reply_markup })
// 		.catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb.reply_markup }))
// }
//
// // ===================================================
// // ПЕРЕМИКАННЯ СТРАВ
// // ===================================================
// bot.action(/^toggle_item:(.+):(.+)$/, (ctx) => {
// 	const uid = ctx.from.id
// 	const [date, item] = ctx.match.slice(1)
// 	const session = userSessions[uid]
//
// 	if (session.selectedDays[date]) {
// 		session.selectedDays[date].items[item] = !session.selectedDays[date].items[item]
// 	}
// 	ctx.answerCbQuery()
// 	showItemsForDay(ctx, uid, date)
// })
//
// // ===================================================
// // ПІДТВЕРДЖЕННЯ ОДНОГО ДНЯ
// // ===================================================
// bot.action(/^confirm_day:(.+)$/, (ctx) => {
// 	const uid = ctx.from.id
// 	const date = ctx.match[1]
// 	const session = userSessions[uid]
//
// 	const dayOrder = session.selectedDays[date]
// 	if (!dayOrder || !dayOrder.type) return
//
// 	ctx.answerCbQuery('День збережено ✓')
//
// 	// Повертаємось до списку днів
// 	session.currentEditingDay = null
// 	showDaysList(ctx, uid)
// })
//
// // ===================================================
// // НАЗАД ДО СПИСКУ ДНІВ
// // ===================================================
// bot.action('back_to_days', (ctx) => {
// 	const uid = ctx.from.id
// 	ctx.answerCbQuery()
// 	showDaysList(ctx, uid)
// })
//
// // ===================================================
// // ЗАВЕРШИТИ ВСІ ЗАМОВЛЕННЯ
// // ===================================================
// bot.action('finish_all', async (ctx) => {
// 	const uid = ctx.from.id
// 	const session = userSessions[uid]
//
// 	const dates = Object.keys(session.selectedDays)
// 	if (dates.length === 0) {
// 		return ctx.answerCbQuery('Ви нічого не замовили!', { show_alert: true })
// 	}
//
// 	let summary = `✅ *Ваше замовлення на тиждень прийнято!*\n\n`
// 	summary += `👤 ${session.name}\n\n`
//
// 	dates.forEach(date => {
// 		const o = session.selectedDays[date]
// 		const itemsList = Object.entries(o.items)
// 			.filter(([, v]) => v)
// 			.map(([k]) => k)
// 			.join(', ')
//
// 		summary += `📅 *${formatDateForUser(date)}* — ${o.type}\n`
// 		summary += `   ${itemsList}\n\n`
//
// 		// Зберігаємо в глобальні замовлення
// 		orders.push({
// 			userId: uid,
// 			name: session.name,
// 			date: date,
// 			type: o.type,
// 			items: { ...o.items },
// 			timestamp: new Date().toISOString()
// 		})
// 	})
//
// 	delete userSessions[uid]
//
// 	await ctx.editMessageText(summary, { parse_mode: 'Markdown' })
//
// 	// Повідомлення адміну
// 	await bot.telegram.sendMessage(ADMIN_ID,
// 		`🔔 *Нове замовлення від ${session.name}!*\n\n${summary}`,
// 		{ parse_mode: 'Markdown' }
// 	)
// })
//
// // ===================================================
// bot.launch()
// console.log('✅ Бот запущено — вибір типу та страв ПО КОЖНОМУ ДНЮ!')
// process.once('SIGINT', () => bot.stop('SIGINT'))
// process.once('SIGTERM', () => bot.stop('SIGTERM'))
