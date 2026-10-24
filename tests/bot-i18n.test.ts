import { describe, expect, it } from 'vitest';
import { translateBotText, translateKeyboard } from '../src/bot/i18n';

describe('Telegram bot language translations', () => {
  it('keeps Uzbek as the default language', () => {
    const text = 'Bugungi odatlar';
    expect(translateBotText(text, 'uz')).toBe(text);
  });

  it('translates bot-authored Uzbek phrases to Russian', () => {
    expect(translateBotText('📅 <b>Bugungi odatlar</b>', 'ru')).toBe('📅 <b>Привычки на сегодня</b>');
    expect(translateBotText('⚙️ <b>Sozlamalar</b>', 'ru')).toBe('⚙️ <b>Настройки</b>');
  });

  it('translates inline keyboard labels without changing callback data', () => {
    const markup = { inline_keyboard: [[{ text: '📱 Ilovani ochish', callback_data: 'open' }]] };
    expect(translateKeyboard(markup, 'ru')).toEqual({ inline_keyboard: [[{ text: '📱 Открыть приложение', callback_data: 'open' }]] });
  });
});
