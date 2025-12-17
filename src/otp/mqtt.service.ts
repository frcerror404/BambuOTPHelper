import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect, MqttClient } from 'mqtt';
import { OtpPayload } from './otp.types';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client?: MqttClient;
  private readonly brokerUrl: string;
  private readonly topic: string;
  private readonly username?: string;
  private readonly password?: string;

  constructor() {
    this.brokerUrl = process.env.OTP_MQTT_URL || 'mqtt://mqtt-broker:1883';
    this.topic = process.env.OTP_MQTT_TOPIC || 'bambu/otp';
    this.username = process.env.OTP_MQTT_USERNAME;
    this.password = process.env.OTP_MQTT_PASSWORD;
  }

  onModuleInit() {
    this.client = connect(this.brokerUrl, {
      username: this.username,
      password: this.password,
      // Allows self-signed certificates by skipping CA verification when using mqtts; set to true when relying on a trusted CA
      rejectUnauthorized: false,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker at ${this.brokerUrl}`);
    });

    this.client.on('error', (error: Error) => {
      this.logger.error('MQTT connection error', error);
    });
  }

  publishOtp(payload: OtpPayload) {
    if (!this.client) {
      this.logger.warn('MQTT client not initialized; skipping publish');
      return;
    }

    if (!this.client.connected) {
      this.logger.warn('MQTT client not connected; skipping publish');
      return;
    }

    const message = JSON.stringify(payload);
    this.client.publish(this.topic, message, { retain: true }, (error?: Error) => {
      if (error) {
        this.logger.error('Failed to publish OTP to MQTT', error);
      }
    });
  }

  onModuleDestroy() {
    if (!this.client) {
      return;
    }

    return new Promise<void>((resolve) => {
      this.client?.end(false, {}, () => {
        resolve();
      });
    });
  }
}
