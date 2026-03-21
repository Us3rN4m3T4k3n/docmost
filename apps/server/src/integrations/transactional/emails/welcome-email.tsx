import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { button, content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';

interface WelcomeEmailProps {
  username: string;
  setPasswordLink: string;
  appUrl: string;
}

export const WelcomeEmail = ({
  username,
  setPasswordLink,
  appUrl,
}: WelcomeEmailProps) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi {username},</Text>
        <Text style={paragraph}>
          Your account has been created. Click the button below to set your
          password and log in.
        </Text>
        <Button href={setPasswordLink} style={button}>
          Set Password &amp; Log In
        </Button>
        <Text style={paragraph}>
          Once logged in, you can access your content at {appUrl}
        </Text>
      </Section>
    </MailBody>
  );
};

export default WelcomeEmail;
