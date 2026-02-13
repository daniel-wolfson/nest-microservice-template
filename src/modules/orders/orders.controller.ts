// src/orders/orders.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
    constructor(private ordersService: OrdersService) {}

    @Post()
    createOrder(@Body() data: { userId: number; items: any[] }) {
        return this.ordersService.createOrder(data);
    }
}
