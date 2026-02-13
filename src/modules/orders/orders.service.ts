// src/orders/orders.controller.ts
import { Controller, Post, Body, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import { v4 as uuid4 } from 'uuid';

@Injectable()
export class OrdersService {
    constructor(private prisma: PrismaService) {}

    async createOrder(data: { userId: number; items: any[] }) {
        const { userId, items } = data;

        return this.prisma.$transaction(async tx => {
            // Create the order
            const order = await tx.order.create({
                data: {
                    id: uuid4() as string,
                    orderNumber: `ORD-${Date.now()}`,
                    guestName: '',
                    status: OrderStatus.PENDING,
                },
            });

            // Create order items
            const orderItems = await Promise.all(
                items.map(item =>
                    tx.orderItem.create({
                        data: {
                            orderId: order.id,
                            itemName: item.itemName,
                            productId: item.productId,
                            quantity: item.quantity,
                        },
                    }),
                ),
            );

            return { order, orderItems };
        });
    }
}
