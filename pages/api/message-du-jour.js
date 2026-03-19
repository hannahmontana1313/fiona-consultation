export default async function handler(req, res) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Génère un court message du jour (2-3 phrases maximum) dans le thème de la voyance, de l'intuition et du destin. Le message doit être mystérieux, poétique et inspirant. Il doit donner envie de consulter une voyante. Date du jour : ${today}. Ne réponds qu'avec le message, sans introduction ni explication.`,
        }],
      }),
    });
    
    const data = await response.json();
    const message = data.content[0].text;
    
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(200).json({ message, date: today });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
