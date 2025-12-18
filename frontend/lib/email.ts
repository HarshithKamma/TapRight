
const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY;

export const sendEmail = async (to: string, subject: string, html: string) => {
    if (!RESEND_API_KEY) {
        console.warn('Missing EXPO_PUBLIC_RESEND_API_KEY, skipping email send.');
        return;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: 'TapRight <info@tapright.app>',
                to: [to],
                subject: subject,
                html: html,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Resend API Error:', errorData);
        }
    } catch (error) {
        console.error('Failed to send email:', error);
    }
};

export const sendWelcomeEmail = async (to: string, name: string) => {
    const subject = 'Welcome to TapRight!';
    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #4F46E5;">Welcome to TapRight, ${name}!</h1>
      <p>We are thrilled to have you on board.</p>
      <p>TapRight helps you maximize your credit card rewards effortlessly.</p>
      <p>Get started by adding your cards and checking your location!</p>
      <br/>
      <p>Cheers,<br/>The TapRight Team</p>
    </div>
  `;
    await sendEmail(to, subject, html);
};

export const sendPasswordChangedEmail = async (to: string) => {
    const subject = 'Your Password was Changed';
    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Password Updated</h2>
      <p>This is a confirmation that the password for your TapRight account was recently changed.</p>
      <p>If you did not perform this action, please contact support immediately.</p>
      <br/>
      <p>Stay Safe,<br/>The TapRight Team</p>
    </div>
  `;
    await sendEmail(to, subject, html);
};
