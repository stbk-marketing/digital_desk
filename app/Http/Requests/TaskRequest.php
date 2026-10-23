<?php

namespace App\Http\Requests;

use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('write', Task::class);
    }

    /** @return array<string, array<mixed>> */
    public function rules(): array
    {
        return [
            'request_id' => ['sometimes', 'uuid'],
            'title' => [$this->isMethod('post') ? 'required' : 'sometimes', 'required', 'string', 'max:500'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:50000'],
            'status' => ['sometimes', Rule::in(['open', 'done'])],
            'due_on' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'project_id' => ['sometimes', 'nullable', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'assigned_to' => ['sometimes', 'nullable', Rule::exists('users', 'id')->where('is_active', true)->whereNotNull('email_verified_at')],
            'snoozed_until' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'archived' => ['sometimes', 'boolean'],
            'expected_version' => [$this->isMethod('patch') ? 'required' : 'sometimes', 'integer', 'min:1'],
        ];
    }
}
